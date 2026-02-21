# Subscription Service

## Source
Extracted from BistroLens `convex/subscriptions.ts`

**Category:** 03-auth-patterns
**Type:** Strategy
**Tags:** subscription, stripe, service-layer, webhooks, tier-management

---

## Overview

The subscription service layer manages Stripe subscription lifecycle: creation, upgrades, downgrades, cancellations, and webhook processing. Keeps Convex subscription records in sync with Stripe.

---

## Pattern

```typescript
// convex/subscriptions.ts — subscription service
import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2023-10-16" });

// --- Queries ---

export const getCurrentSubscription = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();
  },
});

export const getUsage = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const companies = await ctx.db
      .query("companies")
      .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .collect();

    return {
      companies: companies.length,
      menuItems: 0, // compute similarly
      teamMembers: 0,
    };
  },
});

// --- Mutations ---

export const createCheckoutSession = action({
  args: { tier: v.union(v.literal("pro"), v.literal("enterprise")) },
  handler: async (ctx, { tier }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    const PRICE_IDS: Record<string, string> = {
      pro: process.env.STRIPE_PRO_PRICE_ID!,
      enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID!,
    };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: PRICE_IDS[tier], quantity: 1 }],
      success_url: `${process.env.APP_URL}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/upgrade`,
      metadata: { userId: identity.subject, tier },
    });

    return { url: session.url };
  },
});

export const cancelSubscription = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    if (!subscription) throw new ConvexError("No active subscription");

    // Cancel at period end (not immediately)
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    await ctx.db.patch(subscription._id, {
      cancelAtPeriodEnd: true,
    });
  },
});

// --- Webhook handler ---

export const handleStripeWebhook = action({
  args: { payload: v.string(), signature: v.string() },
  handler: async (ctx, { payload, signature }) => {
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch {
      throw new ConvexError("Invalid webhook signature");
    }

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await ctx.runMutation(internal.subscriptions.upsertSubscription, {
          stripeSubscriptionId: sub.id,
          userId: sub.metadata.userId,
          tier: sub.metadata.tier as "pro" | "enterprise",
          status: sub.status,
          currentPeriodEnd: sub.current_period_end * 1000,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await ctx.runMutation(internal.subscriptions.downgradeToFree, {
          stripeSubscriptionId: sub.id,
        });
        break;
      }
    }
  },
});
```

---

## Usage

```typescript
// Upgrade flow
const { url } = await createCheckoutSession({ tier: "pro" });
window.location.href = url; // Redirect to Stripe Checkout

// Check subscription in mutations
const subscription = await ctx.db
  .query("subscriptions")
  .withIndex("by_user", (q) => q.eq("userId", identity.subject))
  .first();

if (!subscription || subscription.tier === "free") {
  throw new ConvexError("Pro subscription required");
}
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Trust client-reported tier
export const createCompany = mutation({
  args: { tier: v.string() }, // Never trust client-provided tier
  handler: async (ctx, { tier }) => { ... },
});

// No webhook signature verification
const event = JSON.parse(payload); // Allows forged webhook events

// Immediate cancellation instead of cancel_at_period_end
await stripe.subscriptions.cancel(subscriptionId); // User loses access immediately
```

### ✅ Do This Instead

```typescript
// Always read tier from server-side subscription record
const subscription = await ctx.db
  .query("subscriptions")
  .withIndex("by_user", (q) => q.eq("userId", identity.subject))
  .first();

// Verify webhook signatures
const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

// Cancel at period end so users keep access until billing cycle ends
await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
```

---

## When to Use This Pattern

✅ **Use for:**
- Managing Stripe subscription lifecycle (create, upgrade, downgrade, cancel)
- Syncing subscription state between Stripe and Convex via webhooks
- Checkout session creation for subscription upgrades

❌ **Don't use for:**
- One-time payments — use Stripe Payment Intents instead
- Free tier management — free users don't have Stripe subscriptions

---

## Benefits

1. Single source of truth — Convex subscription records stay in sync with Stripe via webhooks
2. Cancel-at-period-end preserves user access until the billing cycle completes
3. Webhook signature verification prevents forged subscription events
4. Server-side tier lookup prevents client-side tier spoofing

---

## Related Patterns

- `subscription-enforcement.md` — Server-side tier enforcement
- `../09-hooks/useTierGates.md` — Client-side tier gates
- `../09-hooks/useFreemium.md` — Freemium usage limits
