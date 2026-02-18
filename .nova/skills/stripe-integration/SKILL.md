# Skill: Stripe Integration

## Domain
Payment processing, checkout flows, subscription management, webhook handling

## Agents That Use This Skill
- **GANYMEDE** - API integration (Stripe API calls)
- **VENUS** - Payment forms (checkout UI)
- **MARS** - Backend mutations (payment processing)
- **ENCELADUS** - Security (webhook verification, PCI compliance)

## When to Load
Auto-load when task description contains: `payment`, `stripe`, `billing`, `subscription`, `checkout`, `charge`, `invoice`

## Patterns Provided

### 1. Checkout Session Creation
```typescript
// Create a Stripe Checkout session
export const createCheckoutSession = mutation({
  args: {
    priceId: v.string(),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    
    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: args.priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
    });
    
    return { sessionId: session.id, url: session.url };
  },
});
```

### 2. Webhook Signature Verification
```typescript
// Verify Stripe webhook signature
export const handleStripeWebhook = httpAction(async (ctx, request) => {
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');
  
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const event = stripe.webhooks.constructEvent(
    payload,
    signature!,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
  
  switch (event.type) {
    case 'invoice.payment_succeeded':
      // Handle successful payment
      break;
    case 'customer.subscription.deleted':
      // Handle cancellation
      break;
  }
  
  return new Response(null, { status: 200 });
});
```

### 3. Payment Form Component
```tsx
// VENUS: Stripe Elements payment form
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY!);

export function PaymentForm({ clientSecret }: { clientSecret: string }) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm />
    </Elements>
  );
}
```

## Security Requirements
- NEVER log Stripe secret keys
- ALWAYS verify webhook signatures
- NEVER store full card numbers (Stripe handles this)
- Use row-level isolation for subscription data

## Environment Variables Required
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_KEY=pk_test_...
```

## Common Errors to Avoid
- ❌ Calling Stripe API from frontend (security risk)
- ❌ Not handling webhook retries
- ❌ Storing subscription state in localStorage
- ❌ Forgetting to verify webhook signatures
