import { NextResponse, type NextRequest } from "next/server";

/**
 * Defense-in-depth gate for `/api/*` routes.
 *
 * The dashboard binds to 127.0.0.1 in `package.json` scripts, so the primary
 * protection is the network boundary. This middleware is the second layer: it
 * rejects any `/api/*` request that is neither a same-origin browser fetch nor
 * an authenticated server-to-server call.
 *
 * Allow rules (request passes if ANY of these is true):
 *   1. `Sec-Fetch-Site` is `same-origin` or `none` (regular page-initiated
 *      fetches and direct navigations from the same browser tab).
 *   2. Header `x-agentic-token` matches `process.env.AGENTIC_TOKEN`, when that
 *      env var is set.
 *
 * Otherwise the request gets a plain 403.
 *
 * Note: Next.js 16 deprecated the `middleware` file convention in favor of
 * `proxy`. We keep `middleware.ts` for now per the security review brief;
 * migrate via `npx @next/codemod@canary middleware-to-proxy .` when convenient.
 */
export function middleware(request: NextRequest): NextResponse {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite === "same-origin" || secFetchSite === "none") {
    return NextResponse.next();
  }

  const expectedToken = process.env.AGENTIC_TOKEN;
  if (expectedToken && expectedToken.length > 0) {
    const providedToken = request.headers.get("x-agentic-token");
    if (providedToken === expectedToken) {
      return NextResponse.next();
    }
  }

  return new NextResponse("forbidden", { status: 403 });
}

export const config = {
  matcher: ["/api/:path*"],
};
