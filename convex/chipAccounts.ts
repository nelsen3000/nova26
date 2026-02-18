// Chip Accounts Convex Functions
// Each company has exactly 3 accounts: savings, spending, investment
//
// CHIP MATH RULES (Article V):
//   - $1 revenue = 1 chip (exact)
//   - Math.floor() for ALL conversions — never round up
//   - Balances are non-negative integers — no debt ever
//   - 50% weekly seat tax deducted from spending account
//   - Savings minimum: 20% of all income must go to savings
//   - Transfers from savings require owner approval (enforced by flag)
//   - Transfers from investment require CAS gate (enforced by flag)

import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

// =====================
// CHIP MATH HELPERS
// =====================

/** Convert a dollar amount to chips — always floor, never round up */
function dollarsToChips(dollars: number): number {
  return Math.floor(dollars);
}

/** Calculate seat tax (50% of amount), always floor */
function calcSeatTax(amount: number): number {
  return Math.floor(amount * 0.5);
}

/** Calculate minimum savings allocation (20% of income), always floor */
function calcSavingsAllocation(income: number): number {
  return Math.floor(income * 0.2);
}

// =====================
// MUTATIONS
// =====================

/** Credit revenue to a company: 20% minimum to savings, remainder to spending */
export const creditRevenue = mutation({
  args: {
    companyId: v.id('companies'),
    revenueUsd: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.revenueUsd <= 0) throw new Error('Revenue must be positive');
    if (!Number.isFinite(args.revenueUsd)) throw new Error('Revenue must be finite');

    const totalChips = dollarsToChips(args.revenueUsd);
    const savingsAlloc = calcSavingsAllocation(totalChips);
    const spendingAlloc = totalChips - savingsAlloc;

    const accounts = await ctx.db
      .query('chipAccounts')
      .withIndex('by_company', q => q.eq('companyId', args.companyId))
      .collect();

    const savings = accounts.find(a => a.type === 'savings');
    const spending = accounts.find(a => a.type === 'spending');

    if (!savings || !spending) {
      throw new Error('Company chip accounts not initialized');
    }

    const now = new Date().toISOString();

    await ctx.db.patch(savings._id, {
      balance: savings.balance + savingsAlloc,
      lastTransactionAt: now,
    });
    await ctx.db.patch(spending._id, {
      balance: spending.balance + spendingAlloc,
      lastTransactionAt: now,
    });

    return { totalChips, savingsAlloc, spendingAlloc };
  },
});

/** Deduct weekly seat tax (50%) from the spending account */
export const deductSeatTax = mutation({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    const spending = await ctx.db
      .query('chipAccounts')
      .withIndex('by_company_type', q =>
        q.eq('companyId', args.companyId).eq('type', 'spending')
      )
      .first();

    if (!spending) throw new Error('Spending account not found');

    const tax = calcSeatTax(spending.balance);

    // No debt — if balance < tax somehow, take what's available
    const actualTax = Math.min(tax, spending.balance);

    await ctx.db.patch(spending._id, {
      balance: spending.balance - actualTax,
      lastTransactionAt: new Date().toISOString(),
    });

    return { taxDeducted: actualTax, remainingBalance: spending.balance - actualTax };
  },
});

/**
 * Transfer chips between accounts within a company.
 * Transfers FROM savings require ownerApproved = true.
 * Transfers FROM investment require casApproved = true.
 */
export const transferChips = mutation({
  args: {
    companyId: v.id('companies'),
    fromType: v.union(v.literal('savings'), v.literal('spending'), v.literal('investment')),
    toType: v.union(v.literal('savings'), v.literal('spending'), v.literal('investment')),
    amount: v.number(),
    ownerApproved: v.optional(v.boolean()),
    casApproved: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.fromType === args.toType) throw new Error('Cannot transfer to the same account');
    if (args.amount <= 0) throw new Error('Transfer amount must be positive');
    if (!Number.isFinite(args.amount)) throw new Error('Amount must be finite');

    const chips = Math.floor(args.amount); // Ensure integer
    if (chips === 0) throw new Error('Transfer amount rounds down to 0 chips');

    // Approval gates
    if (args.fromType === 'savings' && !args.ownerApproved) {
      throw new Error('Withdrawals from savings require owner approval');
    }
    if (args.fromType === 'investment' && !args.casApproved) {
      throw new Error('Withdrawals from investment require CAS approval');
    }

    const accounts = await ctx.db
      .query('chipAccounts')
      .withIndex('by_company', q => q.eq('companyId', args.companyId))
      .collect();

    const from = accounts.find(a => a.type === args.fromType);
    const to = accounts.find(a => a.type === args.toType);

    if (!from || !to) throw new Error('Account not found');

    // No debt check
    if (from.balance < chips) {
      throw new Error(
        `Insufficient balance: ${from.balance} chips in ${args.fromType}, requested ${chips}`
      );
    }

    const now = new Date().toISOString();

    await ctx.db.patch(from._id, {
      balance: from.balance - chips,
      lastTransactionAt: now,
    });
    await ctx.db.patch(to._id, {
      balance: to.balance + chips,
      lastTransactionAt: now,
    });

    return { transferred: chips };
  },
});

/** Deduct chips from an account (for expenses). Refuses if balance would go negative. */
export const deductChips = mutation({
  args: {
    companyId: v.id('companies'),
    accountType: v.union(v.literal('savings'), v.literal('spending'), v.literal('investment')),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.amount <= 0) throw new Error('Amount must be positive');
    if (!Number.isFinite(args.amount)) throw new Error('Amount must be finite');

    const chips = Math.floor(args.amount);
    if (chips === 0) throw new Error('Amount rounds down to 0 chips');

    const account = await ctx.db
      .query('chipAccounts')
      .withIndex('by_company_type', q =>
        q.eq('companyId', args.companyId).eq('type', args.accountType)
      )
      .first();

    if (!account) throw new Error('Account not found');
    if (account.balance < chips) {
      throw new Error(`Insufficient balance: ${account.balance} chips, need ${chips}`);
    }

    await ctx.db.patch(account._id, {
      balance: account.balance - chips,
      lastTransactionAt: new Date().toISOString(),
    });

    return { deducted: chips, remainingBalance: account.balance - chips };
  },
});

// =====================
// QUERIES
// =====================

export const getAccountsByCompany = query({
  args: { companyId: v.id('companies') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('chipAccounts')
      .withIndex('by_company', q => q.eq('companyId', args.companyId))
      .collect();
  },
});

export const getAccount = query({
  args: {
    companyId: v.id('companies'),
    type: v.union(v.literal('savings'), v.literal('spending'), v.literal('investment')),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('chipAccounts')
      .withIndex('by_company_type', q =>
        q.eq('companyId', args.companyId).eq('type', args.type)
      )
      .first();
  },
});

/** Total chips across all 3 accounts for a company */
export const getTotalBalance = query({
  args: { companyId: v.id('companies') },
  handler: async (ctx, args) => {
    const accounts = await ctx.db
      .query('chipAccounts')
      .withIndex('by_company', q => q.eq('companyId', args.companyId))
      .collect();

    return accounts.reduce((sum, a) => sum + a.balance, 0);
  },
});
