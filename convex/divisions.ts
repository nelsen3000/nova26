// Divisions Convex Functions
// Each company has exactly 5 divisions.
// Leaderboard: ranked by revenue, ties broken by efficiency ratio (revenue/expenses).
// All revenue/expense values are integer chips.

import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

const MAX_DIVISIONS_PER_COMPANY = 5;
const MAX_AGENTS_PER_DIVISION = 101;
const MAX_SKILLS_PER_DIVISION = 10;

// =====================
// MUTATIONS
// =====================

export const createDivision = mutation({
  args: {
    companyId: v.id('companies'),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.name.trim()) throw new Error('Division name cannot be empty');

    const company = await ctx.db.get(args.companyId);
    if (!company) throw new Error('Company not found');
    if (company.status !== 'active') throw new Error('Cannot create divisions for inactive company');

    // Enforce 5-division limit
    const existing = await ctx.db
      .query('divisions')
      .withIndex('by_company', q => q.eq('companyId', args.companyId))
      .collect();

    if (existing.length >= MAX_DIVISIONS_PER_COMPANY) {
      throw new Error(`Company already has the maximum of ${MAX_DIVISIONS_PER_COMPANY} divisions`);
    }

    return await ctx.db.insert('divisions', {
      companyId: args.companyId,
      name: args.name,
      revenue: 0,
      expenses: 0,
      agentCount: 0,
      status: 'active',
    });
  },
});

export const updateDivisionStatus = mutation({
  args: {
    divisionId: v.id('divisions'),
    status: v.union(v.literal('active'), v.literal('paused')),
  },
  handler: async (ctx, args) => {
    const division = await ctx.db.get(args.divisionId);
    if (!division) throw new Error('Division not found');
    await ctx.db.patch(args.divisionId, { status: args.status });
  },
});

/** Record revenue earned by a division (integer chips) */
export const addDivisionRevenue = mutation({
  args: {
    divisionId: v.id('divisions'),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.amount <= 0) throw new Error('Amount must be positive');
    if (!Number.isFinite(args.amount)) throw new Error('Amount must be finite');

    const chips = Math.floor(args.amount);
    if (chips === 0) throw new Error('Amount rounds down to 0 chips');

    const division = await ctx.db.get(args.divisionId);
    if (!division) throw new Error('Division not found');

    await ctx.db.patch(args.divisionId, {
      revenue: division.revenue + chips,
    });

    return { added: chips, totalRevenue: division.revenue + chips };
  },
});

/** Record expenses incurred by a division (integer chips) */
export const addDivisionExpenses = mutation({
  args: {
    divisionId: v.id('divisions'),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.amount <= 0) throw new Error('Amount must be positive');
    if (!Number.isFinite(args.amount)) throw new Error('Amount must be finite');

    const chips = Math.floor(args.amount);
    if (chips === 0) throw new Error('Amount rounds down to 0 chips');

    const division = await ctx.db.get(args.divisionId);
    if (!division) throw new Error('Division not found');

    await ctx.db.patch(args.divisionId, {
      expenses: division.expenses + chips,
    });

    return { added: chips, totalExpenses: division.expenses + chips };
  },
});

/** Increment or decrement the agent count for a division */
export const adjustAgentCount = mutation({
  args: {
    divisionId: v.id('divisions'),
    delta: v.number(), // +1 to add, -1 to remove
  },
  handler: async (ctx, args) => {
    if (args.delta === 0) return;

    const division = await ctx.db.get(args.divisionId);
    if (!division) throw new Error('Division not found');

    const newCount = division.agentCount + args.delta;

    if (newCount < 0) throw new Error('Agent count cannot be negative');
    if (newCount > MAX_AGENTS_PER_DIVISION) {
      throw new Error(`Division cannot exceed ${MAX_AGENTS_PER_DIVISION} agents`);
    }

    await ctx.db.patch(args.divisionId, { agentCount: newCount });
    return { agentCount: newCount };
  },
});

// =====================
// QUERIES
// =====================

export const getDivision = query({
  args: { divisionId: v.id('divisions') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.divisionId);
  },
});

export const getDivisionsByCompany = query({
  args: { companyId: v.id('companies') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('divisions')
      .withIndex('by_company', q => q.eq('companyId', args.companyId))
      .collect();
  },
});

/**
 * Division leaderboard for a company.
 * Sorted by revenue descending; ties broken by efficiency ratio (revenue / expenses).
 * Returns divisions with computed rank and efficiency.
 */
export const getDivisionLeaderboard = query({
  args: { companyId: v.id('companies') },
  handler: async (ctx, args) => {
    const divisions = await ctx.db
      .query('divisions')
      .withIndex('by_company_revenue', q => q.eq('companyId', args.companyId))
      .order('desc')
      .collect();

    // Attach efficiency ratio and rank
    const ranked = divisions
      .map(d => ({
        ...d,
        // Avoid division by zero — if expenses are 0, efficiency is Infinity (pure profit)
        efficiency: d.expenses > 0 ? Math.floor((d.revenue / d.expenses) * 100) / 100 : Infinity,
      }))
      .sort((a, b) => {
        if (b.revenue !== a.revenue) return b.revenue - a.revenue;
        // Tie-break by efficiency (higher is better)
        if (b.efficiency === Infinity && a.efficiency !== Infinity) return -1;
        if (a.efficiency === Infinity && b.efficiency !== Infinity) return 1;
        return (b.efficiency as number) - (a.efficiency as number);
      })
      .map((d, idx) => ({ ...d, rank: idx + 1 }));

    return ranked;
  },
});

/** Check how many divisions a company currently has */
export const getDivisionCount = query({
  args: { companyId: v.id('companies') },
  handler: async (ctx, args) => {
    const divisions = await ctx.db
      .query('divisions')
      .withIndex('by_company', q => q.eq('companyId', args.companyId))
      .collect();
    return divisions.length;
  },
});
