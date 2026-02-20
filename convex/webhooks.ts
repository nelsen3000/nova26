// Convex server functions for webhook handling
// Receives events from external services (GitHub, CI/CD, monitoring)

import { httpAction } from './_generated/server';
import { v } from 'convex/values';
import crypto from 'crypto';

// Rate limiter state (in-memory, resets on deploy)
const rateLimitStore: Record<string, number[]> = {};

// Simple rate limiter: max 100 requests per minute per source
function checkRateLimit(sourceId: string, maxPerMinute: number = 100): boolean {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;

  if (!rateLimitStore[sourceId]) {
    rateLimitStore[sourceId] = [];
  }

  // Clean old timestamps
  rateLimitStore[sourceId] = rateLimitStore[sourceId].filter(
    (t) => t > oneMinuteAgo
  );

  // Check limit
  if (rateLimitStore[sourceId].length >= maxPerMinute) {
    return false;
  }

  // Record request
  rateLimitStore[sourceId].push(now);
  return true;
}

// Validate GitHub webhook signature
function validateGitHubSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return `sha256=${expectedSignature}` === signature;
}

// Handle GitHub webhook events
export const handleGitHubWebhook = httpAction(async (ctx, request) => {
  // Only accept POST
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Get signature from headers
    const signature = request.headers.get('x-hub-signature-256');
    if (!signature) {
      return new Response('Missing signature', { status: 401 });
    }

    // Get payload
    const body = await request.text();

    // Validate signature (would use process.env.GITHUB_WEBHOOK_SECRET in production)
    const webhookSecret = 'github-secret'; // TODO: use env var
    if (!validateGitHubSignature(body, signature, webhookSecret)) {
      return new Response('Invalid signature', { status: 401 });
    }

    // Parse payload
    const payload = JSON.parse(body);

    // Rate limit by source repository
    const sourceId = payload.repository?.full_name || 'unknown';
    if (!checkRateLimit(sourceId, 100)) {
      return new Response('Rate limit exceeded', { status: 429 });
    }

    // Log webhook event
    await ctx.db.insert('agentActivityFeed', {
      userId: 'system',
      agentName: 'GitHub',
      eventType: 'task_started',
      details: `GitHub event: ${payload.action} on ${payload.repository?.name}`,
      timestamp: new Date().toISOString(),
    });

    // Process different event types
    const eventType = request.headers.get('x-github-event');

    if (eventType === 'push') {
      return new Response(
        JSON.stringify({
          status: 'received',
          commits: payload.commits?.length || 0,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (eventType === 'pull_request') {
      return new Response(
        JSON.stringify({
          status: 'received',
          action: payload.action,
          pr: payload.number,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (eventType === 'issues') {
      return new Response(
        JSON.stringify({
          status: 'received',
          action: payload.action,
          issue: payload.issue?.number,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Default response for unhandled events
    return new Response(
      JSON.stringify({ status: 'received', eventType }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('GitHub webhook error:', error);
    return new Response('Internal server error', { status: 500 });
  }
});

// Handle CI/CD build completion notifications
export const handleBuildComplete = httpAction(async (ctx, request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.buildId || !body.status) {
      return new Response('Missing required fields', { status: 400 });
    }

    // Rate limit by CI system
    const sourceId = body.source || 'unknown-ci';
    if (!checkRateLimit(sourceId, 200)) {
      return new Response('Rate limit exceeded', { status: 429 });
    }

    // Find and update Convex build record
    const builds = await ctx.db
      .query('builds')
      .filter(
        (q) =>
          q.eq(q.field('prdId'), body.buildId)
      )
      .collect();

    if (builds.length === 0) {
      return new Response('Build not found', { status: 404 });
    }

    const build = builds[0];
    const status = body.status === 'success' ? 'completed' : 'failed';

    // Update build status
    await ctx.db.patch(build._id, {
      status,
      completedAt: new Date().toISOString(),
      error: body.status === 'success' ? undefined : body.error,
    });

    // Log activity
    await ctx.db.insert('agentActivityFeed', {
      userId: 'system',
      agentName: 'CI/CD',
      eventType: status === 'completed' ? 'task_completed' : 'task_failed',
      details: `Build ${status}: ${build.prdName}`,
      timestamp: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        status: 'updated',
        buildId: body.buildId,
        convexStatus: status,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Build complete webhook error:', error);
    return new Response('Internal server error', { status: 500 });
  }
});

// Handle monitoring/alerting webhooks
export const handleAlertWebhook = httpAction(async (ctx, request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.alertType || !body.message) {
      return new Response('Missing required fields', { status: 400 });
    }

    // Rate limit by alert source
    const sourceId = body.source || 'unknown-monitor';
    if (!checkRateLimit(sourceId, 50)) {
      return new Response('Rate limit exceeded', { status: 429 });
    }

    // Log alert as activity
    await ctx.db.insert('agentActivityFeed', {
      userId: 'system',
      agentName: 'Monitoring',
      eventType: 'task_failed', // Alerts are treated as failures
      details: `${body.alertType}: ${body.message}`,
      timestamp: new Date().toISOString(),
    });

    // Optionally create a critical build if alert severity is high
    if (body.severity === 'critical') {
      const buildId = await ctx.db.insert('builds', {
        prdId: `alert-${Date.now()}`,
        prdName: `Critical Alert: ${body.alertType}`,
        status: 'failed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        error: body.message,
      });

      return new Response(
        JSON.stringify({
          status: 'alert_recorded',
          buildId,
          severity: body.severity,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        status: 'alert_recorded',
        severity: body.severity,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Alert webhook error:', error);
    return new Response('Internal server error', { status: 500 });
  }
});

// Get webhook logs for debugging
export const getWebhookLogs = httpAction(async (ctx, request) => {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Get recent webhook-related activities
  const activities = await ctx.db
    .query('agentActivityFeed')
    .filter(
      (q) =>
        q.or(
          q.eq(q.field('agentName'), 'GitHub'),
          q.eq(q.field('agentName'), 'CI/CD'),
          q.eq(q.field('agentName'), 'Monitoring')
        )
    )
    .order('desc')
    .take(50);

  return new Response(
    JSON.stringify({
      logs: activities,
      count: activities.length,
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
