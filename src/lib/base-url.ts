/**
 * Public base-URL resolution — the single place that decides the absolute origin of this app.
 *
 * Why this exists: Next.js derives `request.url` from the socket the server listens on, so in a
 * container/cloud sandbox the origin can come out as `http://0.0.0.0:3000`. Handing that to a
 * browser produces ERR_ADDRESS_INVALID (the escrow checkout redirect bug). Every absolute URL
 * that leaves the server for a browser — payment redirects, gateway return URLs, OAuth callbacks,
 * email links — must therefore be built from, in order:
 *
 *   1. the host the visitor actually used (x-forwarded-host / host + x-forwarded-proto), or
 *   2. a validated environment value (APP_URL, NEXT_PUBLIC_APP_URL, PUBLIC_URL, BASE_URL), or
 *   3. a loopback fallback for local development.
 *
 * Wildcard/bind addresses (0.0.0.0, ::, *) are never used, and only well-formed absolute http(s)
 * URLs are ever produced or returned to the browser.
 *
 * The module is environment-agnostic (safe to import from server and client components) and
 * contains no Node.js dependencies.
 */

export type OriginInfo = {
  /** `https://host[:port]` */
  origin: string;
  /** Hostname without port, e.g. `app.example.com`, `127.0.0.1`, `[::1]` */
  hostname: string;
  protocol: "http:" | "https:";
  /** A wildcard/unspecified address (0.0.0.0, ::) — never valid in a browser-facing URL. */
  bind: boolean;
  /** localhost / 127.0.0.0/8 / ::1 — only valid for the machine that runs the browser. */
  loopback: boolean;
  /** True when a browser on another device could plausibly open this host. */
  routable: boolean;
};

/** Environment variables checked (in order) when a request host is unavailable or unusable. */
export const ENV_BASE_URL_KEYS = ["APP_URL", "NEXT_PUBLIC_APP_URL", "PUBLIC_URL", "BASE_URL"] as const;

const hasProcess = () => typeof process !== "undefined" && !!process.env;

const unbracket = (hostname: string) => hostname.trim().toLowerCase().replace(/^\[/, "").replace(/\]$/, "");

/** Accepts either a hostname or `host[:port]` and returns the hostname part. */
function hostOnly(value: string): string {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return "";
  if (raw.startsWith("[")) {
    const end = raw.indexOf("]");
    return end === -1 ? raw.slice(1) : raw.slice(1, end);
  }
  const colon = raw.lastIndexOf(":");
  if (colon !== -1 && colon === raw.indexOf(":") && /^\d+$/.test(raw.slice(colon + 1))) return raw.slice(0, colon);
  return raw;
}

/** 0.0.0.0, ::, * — an interface bind address, never a real destination. */
export function isBindHost(hostname: string): boolean {
  const h = hostOnly(hostname);
  if (!h) return true;
  if (h === "*" || h === "::" || h === "::0" || h === "0:0:0:0:0:0:0:0") return true;
  // "0" and "0.0.0.0" are the same unspecified address (WHATWG URL normalises 0 → 0.0.0.0).
  return h === "0" || /^0+(?:\.0+){3}$/.test(h);
}

/** localhost / *.localhost / 127.0.0.0/8 / ::1 */
export function isLoopbackHost(hostname: string): boolean {
  const h = hostOnly(hostname);
  return h === "localhost" || h.endsWith(".localhost") || h === "::1" || /^127\./.test(h);
}

const isIpLiteral = (hostname: string) => hostname.startsWith("[") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(unbracket(hostname));

/**
 * Parse `host[:port]` or a full URL into a validated origin. Returns null for anything that is
 * not an http(s) origin: bad syntax, credentials, paths, query strings, other schemes.
 * Also protects against Host-header injection (a header must never smuggle a path or host list).
 */
export function parseOriginInfo(candidate: string | null | undefined): OriginInfo | null {
  const raw = (candidate ?? "").trim();
  if (!raw || /[\s@"'<>\\^`{|}]/.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw.includes("://") ? raw : `http://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (url.pathname !== "/" || url.search || url.hash) return null;
  if (!url.hostname) return null;
  const bind = isBindHost(url.hostname);
  const loopback = !bind && isLoopbackHost(url.hostname);
  const hostname = url.hostname;
  return {
    origin: `${url.protocol}//${url.host}`,
    hostname,
    protocol: url.protocol as "http:" | "https:",
    bind,
    loopback,
    routable: !bind && !loopback && (isIpLiteral(hostname) || unbracket(hostname).includes(".")),
  };
}

/** Value of the first hop of a comma-separated proxy header. */
const firstHop = (value: string | null) => (value ?? "").split(",")[0].trim();

/**
 * Which scheme can the visitor actually use?
 *
 * A proxy that terminates TLS reports `https`. Careful with the opposite case: a proxy that talks
 * plain HTTP to the app (Next.js itself fills `x-forwarded-proto` in from the socket it listens on)
 * reports `http` even though the browser is on https. So `http` is trusted only when the host
 * carries an explicit non-default port (LAN/tunnel/dev, e.g. `192.168.1.5:3000`); a bare public
 * hostname is kept on https. An http-only public deployment should set APP_URL.
 */
function resolveProtocol(forwardedProto: string, info: OriginInfo, explicitNonDefaultPort: boolean): "http:" | "https:" {
  if (forwardedProto === "https") return "https:";
  if (forwardedProto === "http") return explicitNonDefaultPort || !info.routable ? "http:" : "https:";
  return info.loopback || explicitNonDefaultPort ? "http:" : "https:";
}

/**
 * The origin the visitor actually used, from x-forwarded-host/x-forwarded-proto (falling back to
 * host). The client port is taken from the host header itself: proxies may also send
 * `x-forwarded-port` with their internal port (Next.js fills it in from the socket it listens on),
 * and appending that to a public hostname produces URLs such as `https://app.example.com:3000`
 * that no browser can reach.
 */
export function requestOriginInfo(req: Request): OriginInfo | null {
  let headers: Headers;
  try {
    headers = req.headers;
  } catch {
    return null;
  }
  const host = firstHop(headers.get("x-forwarded-host")) || firstHop(headers.get("host"));
  const info = parseOriginInfo(host);
  if (!info) return null;

  const authority = new URL(info.origin).host;
  const protocol = resolveProtocol(firstHop(headers.get("x-forwarded-proto")).toLowerCase(), info, new URL(info.origin).port !== "");

  return { ...info, origin: `${protocol}//${authority}`, protocol };
}

/** First usable configured origin. Bind addresses and malformed values are ignored. */
export function envOriginInfo(): OriginInfo | null {
  if (!hasProcess()) return null;
  for (const key of ENV_BASE_URL_KEYS) {
    const info = parseOriginInfo(process.env[key]);
    if (info && !info.bind) return info;
  }
  return null;
}

/** Case-insensitive hostname comparison (IPv6 brackets ignored). */
function sameHostname(a: string, b: string): boolean {
  return !!a && !!b && unbracket(a).toLowerCase() === unbracket(b).toLowerCase();
}

/* The last public origin seen on a request: lets background work (emails, receipts) build links
 * even when no APP_URL is configured. Only public hosts are remembered, never loopback/bind. */
let observedOrigin: string | null = null;

function remember(origin: string): string {
  observedOrigin = origin;
  return origin;
}

/** Last public origin seen by this server process (null before the first such request). */
export function observedPublicOrigin(): string | null {
  return observedOrigin;
}

export function forgetObservedPublicOrigin() {
  observedOrigin = null;
}

/**
 * The absolute origin of this app for browser-facing URLs.
 * Never returns `0.0.0.0`, `*`, `::` or an otherwise malformed URL.
 */
export function publicOrigin(req?: Request | null): string {
  const fromRequest = req ? requestOriginInfo(req) : null;
  const fromEnv = envOriginInfo();

  if (fromRequest?.routable) {
    // A configured APP_URL for this very hostname wins: it carries the deployment's real scheme
    // and port (e.g. an http-only domain). A stale/other APP_URL never overrides the live host.
    if (fromEnv && !fromEnv.loopback && sameHostname(fromEnv.hostname, fromRequest.hostname)) return remember(fromEnv.origin);
    return remember(fromRequest.origin);
  }

  if (fromEnv && !fromEnv.loopback) return remember(fromEnv.origin);
  if (fromEnv) return fromEnv.origin;

  // Local development: keep the loopback host the developer actually typed (e.g. 127.0.0.1:8080).
  // Single-label internal names (docker service names such as `app:3000`) are skipped: a browser
  // elsewhere cannot resolve them — set APP_URL when a proxy rewrites the Host header that way.
  if (fromRequest && !fromRequest.bind && fromRequest.loopback) return fromRequest.origin;

  // Background work (notification emails, receipts) has no request: reuse the last public origin
  // this server served, so links still match the live domain.
  if (observedOrigin) return observedOrigin;

  const port = hasProcess() ? process.env.PORT || "3000" : "3000";
  return `http://localhost:${port}`;
}

/** Join a path to the resolved public origin, e.g. absoluteUrl(req, "/wallet?payment=MLT1"). */
export function absoluteUrl(req: Request | null | undefined, path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${publicOrigin(req)}${suffix}`;
}

/** True for a well-formed absolute http(s) URL. */
export function isValidHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return (url.protocol === "http:" || url.protocol === "https:") && !!url.hostname;
  } catch {
    return false;
  }
}

export type RedirectResolution = { ok: true; url: string; rewritten: boolean } | { ok: false; error: string };

/**
 * Browser-side guard for redirect/form URLs coming back from the API.
 *
 * Validates the scheme, and if a bind/loopback host is returned while the page itself is served
 * from a public origin, the URL is re-pointed at `window.location.origin` (same path, so e.g.
 * `http://0.0.0.0:3000/pay/sandbox/MLT1` becomes `https://3000-abc.e2b.app/pay/sandbox/MLT1`)
 * instead of failing with ERR_ADDRESS_INVALID. Third-party gateway URLs (Stripe, JazzCash,
 * Easypaisa) are never rewritten.
 */
export function resolveBrowserRedirect(raw: unknown, pageOrigin: string): RedirectResolution {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, error: "The payment gateway did not return a checkout URL. Please try again." };
  let target: URL;
  try {
    target = new URL(raw.trim(), pageOrigin);
  } catch {
    return { ok: false, error: "The payment gateway returned a malformed checkout URL. Please try again." };
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return { ok: false, error: `Refused to open an unsupported link (${target.protocol}) from the payment gateway.` };
  }

  let page: URL | null = null;
  try {
    page = new URL(pageOrigin);
  } catch {
    page = null;
  }
  const pageUsable = !!page && /^https?:$/.test(page.protocol) && !!page.hostname && !isBindHost(page.hostname);
  const targetUnusable = isBindHost(target.hostname) || (isLoopbackHost(target.hostname) && pageUsable && !isLoopbackHost(page!.hostname));

  if (!targetUnusable) return { ok: true, url: target.toString(), rewritten: false };
  if (!pageUsable) return { ok: false, error: "The site could not determine its own public address. Reload the page and try again." };

  target.protocol = page!.protocol;
  target.hostname = page!.hostname;
  target.port = page!.port;
  return { ok: true, url: target.toString(), rewritten: true };
}
