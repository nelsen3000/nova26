import { defineConfig } from '@convex-dev/auth/server';
import GitHub from '@auth/core/providers/github';

export default defineConfig({
  providers: [
    // Email + password (always available)
    {
      id: 'password',
      type: 'credentials',
    },
    // GitHub OAuth (optional — requires GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET)
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? [
          GitHub({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
});
