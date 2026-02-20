import { httpRouter } from 'convex/server';
import { handleGitHubWebhook, handleBuildComplete, handleAlertWebhook, getWebhookLogs } from './webhooks';

const http = httpRouter();

// ==========================================
// Health Check Endpoint
// ==========================================
http.route({
  path: '/health',
  method: 'GET',
  handler: async (_ctx) => {
    return new Response(
      JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  },
});

// ==========================================
// Webhook Endpoints (H8)
// ==========================================

// GitHub webhook: https://your-domain/api/webhooks/github
// Events: push, pull_request, issues, etc.
http.route({
  path: '/webhooks/github',
  method: 'POST',
  handler: handleGitHubWebhook,
});

// CI/CD build completion: https://your-domain/api/webhooks/build
// Payload: { buildId, status, source, error? }
http.route({
  path: '/webhooks/build',
  method: 'POST',
  handler: handleBuildComplete,
});

// Monitoring alerts: https://your-domain/api/webhooks/alert
// Payload: { alertType, message, source, severity? }
http.route({
  path: '/webhooks/alert',
  method: 'POST',
  handler: handleAlertWebhook,
});

// Get webhook logs for debugging: https://your-domain/api/webhooks/logs
http.route({
  path: '/webhooks/logs',
  method: 'GET',
  handler: getWebhookLogs,
});

// HTTP routes are registered here.
// Convex Auth HTTP routes (sign-in, sign-out, OAuth callbacks)
// are added by convex/auth.ts via the auth middleware.

export default http;
