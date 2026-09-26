export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function ok<T>(data: T, status = 200) {
  return Response.json({ success: true, data }, { status });
}

export function fail(err: unknown) {
  if (err instanceof ApiError) {
    return Response.json({ success: false, error: err.message, details: err.details }, { status: err.status });
  }
  // Next.js redirect / notFound errors should bubble
  if (err && typeof err === "object" && "digest" in err) throw err;
  console.error("[api] unexpected error", err);
  return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
}

export async function handle<T>(fn: () => Promise<T>, status = 200) {
  try {
    const data = await fn();
    return ok(data, status);
  } catch (e) {
    return fail(e);
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object") throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
}

export function str(body: Record<string, unknown>, key: string, opts: { required?: boolean; max?: number } = {}) {
  const v = body[key];
  if (v === undefined || v === null || v === "") {
    if (opts.required) throw new ApiError(422, `Field '${key}' is required`);
    return undefined;
  }
  if (typeof v !== "string") throw new ApiError(422, `Field '${key}' must be a string`);
  const t = v.trim();
  if (opts.max && t.length > opts.max) throw new ApiError(422, `Field '${key}' exceeds ${opts.max} chars`);
  return t;
}

export function num(body: Record<string, unknown>, key: string, opts: { required?: boolean; min?: number; max?: number } = {}) {
  const v = body[key];
  if (v === undefined || v === null || v === "") {
    if (opts.required) throw new ApiError(422, `Field '${key}' is required`);
    return undefined;
  }
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) throw new ApiError(422, `Field '${key}' must be a number`);
  if (opts.min !== undefined && n < opts.min) throw new ApiError(422, `Field '${key}' must be ≥ ${opts.min}`);
  if (opts.max !== undefined && n > opts.max) throw new ApiError(422, `Field '${key}' must be ≤ ${opts.max}`);
  return n;
}

export function oneOf<T extends string>(body: Record<string, unknown>, key: string, values: readonly T[], required = false): T | undefined {
  const v = body[key];
  if (v === undefined || v === null || v === "") {
    if (required) throw new ApiError(422, `Field '${key}' is required`);
    return undefined;
  }
  if (typeof v !== "string" || !values.includes(v as T)) {
    throw new ApiError(422, `Field '${key}' must be one of: ${values.join(", ")}`);
  }
  return v as T;
}
