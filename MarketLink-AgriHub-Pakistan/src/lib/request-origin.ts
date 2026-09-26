/**
 * Resolves the public-facing origin (scheme + host) of the running app.
 *
 * Why this exists: behind a reverse proxy / cloud sandbox (Docker, Render,
 * e2b, etc.) the server usually listens on the bind address `0.0.0.0` (or
 * `localhost`) while the browser reaches it through a different public
 * hostname. `new URL(req.url).origin` reflects the socket the request was
 * *received on*, not the address the browser used, so it can resolve to
 * something like `http://0.0.0.0:3000` — which is not a routable/dialable
 * address and produces `ERR_ADDRESS_INVALID` when used to build a redirect
 * or callback URL.
 *
 * The fix is to prefer, in order:
 *   1. `APP_URL` env var, when explicitly configured for the deployment.
 *   2. The `X-Forwarded-Host` / `Host` request headers (set correctly by
 *      virtually every proxy, including the browser's own `Host` header on
 *      direct connections), paired with `X-Forwarded-Proto` for scheme.
 *   3. `req.url`'s origin, only as a last resort when no headers are present.
 *
 * As a final safety net, if the resolved origin still points at a
 * non-routable bind address (`0.0.0.0`, `::`, empty host), we swap in
 * `localhost` so the URL is at least dialable in a local/dev context rather
 * than producing an invalid address in front of the user.
 */

const BIND_ADDRESSES = new Set(["0.0.0.0", "::", "[::]", ""]);

function sanitizeHost(host: string): string {
  const hostname = host.split(":")[0];
  if (BIND_ADDRESSES.has(hostname)) {
    const port = host.includes(":") ? host.slice(host.indexOf(":")) : "";
    return `localhost${port}`;
  }
  return host;
}

/** Returns true only for a well-formed absolute http/https URL. */
export function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Best-effort public origin for the current request, e.g. `https://app.example.com`.
 * Always returns a well-formed `scheme://host[:port]` string with no trailing slash.
 */
export function publicOrigin(req?: Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured && isValidHttpUrl(configured)) return configured.replace(/\/$/, "");

  if (req) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (host) {
      const safeHost = sanitizeHost(host);
      const proto = req.headers.get("x-forwarded-proto") ?? (safeHost.startsWith("localhost") || safeHost.startsWith("127.") ? "http" : "https");
      const candidate = `${proto}://${safeHost}`;
      if (isValidHttpUrl(candidate)) return candidate;
    }
    try {
      const fallback = new URL(req.url);
      const safeHost = sanitizeHost(fallback.host);
      const candidate = `${fallback.protocol}//${safeHost}`;
      if (isValidHttpUrl(candidate)) return candidate;
    } catch {
      /* fall through to default below */
    }
  }

  return "http://localhost:3000";
}
