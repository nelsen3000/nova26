// Companies Convex Functions
// ROOT entity — no companyId field (it IS the company)
// Rules: chips are integers, Math.floor for all conversions, no debt

import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

const VALID_SECTORS = [
  'Technology',
  'Healthcare',
  'Financials',
  'Consumer Discretionary',
  'Consumer Staples',
  'Energy',
  'Industrials',
  'Materials',
  'Utilities',
  'Real Estate',
  'Communication Services',
] as const;

// =====================
// MUTATIONS
// =====================

export const createCompany = mutation({
  args: {
    name: v.string(),
    sector: v.string(),
    ceoPersona: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate name length (3–50 chars)
    if (args.name.length < 3 || args.name.length > 50) {
      throw new Error('Company name must be 3–50 characters');
    }

    // Validate sector
    if (!(VALID_SECTORS as readonly string[]).includes(args.sector)) {
      throw new Error(`Invalid sector. Must be one of: ${VALID_SECTORS.join(', ')}`);
    }

    // Validate ceoPersona not empty
    if (!args.ceoPersona.trim()) {
      throw new Error('CEO persona cannot be empty');
    }

    // Check name uniqueness
    const existing = await ctx.db
      .query('companies')
      .filter(q => q.eq(q.field('name'), args.name))
      .first();
    if (existing) {
      throw new Error(`Company name "${args.name}" is already taken`);
    }

    const companyId = await ctx.db.insert('companies', {
      name: args.name,
      sector: args.sector,
      ceoPersona: args.ceoPersona,
      status: 'active',
      createdAt: new Date().toISOString(),
    });

    // Bootstrap the 3 chip accounts (savings, spending, investment) at 0
    await ctx.db.insert('chipAccounts', {
      companyId,
      type: 'savings',
      balance: 0,
      lastTransactionAt: new Date().toISOString(),
    });
    await ctx.db.insert('chipAccounts', {
      companyId,
      type: 'spending',
      balance: 0,
      lastTransactionAt: new Date().toISOString(),
    });
    await ctx.db.insert('chipAccounts', {
      companyId,
      type: 'investment',
      balance: 0,
      lastTransactionAt: new Date().toISOString(),
    });

    return companyId;
  },
});

export const updateCompanyStatus = mutation({
  args: {
    companyId: v.id('companies'),
    status: v.union(v.literal('active'), v.literal('suspended'), v.literal('bankrupt')),
  },
  handler: async (ctx, args) => {
    const company = await ctx.db.get(args.companyId);
    if (!company) throw new Error('Company not found');

    // Cannot reactivate a bankrupt company
    if (company.status === 'bankrupt' && args.status !== 'bankrupt') {
      throw new Error('Bankrupt companies cannot be reactivated');
    }

    await ctx.db.patch(args.companyId, { status: args.status });
  },
});

// =====================
// QUERIES
// =====================

export const getCompany = query({
  args: { companyId: v.id('companies') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.companyId);
  },
});

export const listCompaniesByStatus = query({
  args: {
    status: v.union(v.literal('active'), v.literal('suspended'), v.literal('bankrupt')),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('companies')
      .withIndex('by_status', q => q.eq('status', args.status))
      .collect();
  },
});

export const listCompaniesBySector = query({
  args: { sector: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('companies')
      .withIndex('by_sector', q => q.eq('sector', args.sector))
      .collect();
  },
});

export const listAllCompanies = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('companies').collect();
  },
});
