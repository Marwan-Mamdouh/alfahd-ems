import type { NextConfig } from "next";

/**
 * Server-side base URL of the NestJS API.
 *
 * Deliberately NOT prefixed with `NEXT_PUBLIC_`: those values are inlined into
 * the client bundle at build time, which would expose the internal host to every
 * visitor. This variable is only ever read here, at build/config time.
 */
const API_URL = process.env.API_URL;

if (!API_URL) {
  // Fail loudly rather than building an app whose every API call silently fails.
  // `apps/web/.env.local` is gitignored, so CI and fresh clones have no value
  // until it is supplied — see the `env:` block in .github/workflows/ci.yml.
  throw new Error(
    "API_URL is not set. Add it to apps/web/.env.local (see .env.example) — it is the rewrite target for /api/*."
  );
}

const nextConfig: NextConfig = {
  devIndicators: false,

  /**
   * Proxy every API call through this app's own origin.
   *
   * This is what makes the httpOnly refresh cookie work. The API sets that
   * cookie on login; if the browser called Railway directly the cookie would
   * belong to the Railway domain and Next.js middleware on this origin could
   * never read it, so the route guard would redirect every user to login.
   *
   * Source must be `/api/:path*` to match the backend's unversioned routes
   * (`/auth/login` → `/api/auth/login`).
   */
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
