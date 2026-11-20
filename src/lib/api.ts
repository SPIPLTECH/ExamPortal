import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";

export function ok<T>(data: T, init?: number) {
  return NextResponse.json({ data }, { status: init ?? 200 });
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** Parse + validate a JSON body; returns either data or a 400 response. */
export async function parseBody<T>(
  req: Request,
  schema: ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return { data: null, error: fail("Invalid JSON body", 400) };
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    return {
      data: null,
      error: fail("Validation failed", 422, {
        issues: flattenZod(result.error),
      }),
    };
  }
  return { data: result.data, error: null };
}

export function flattenZod(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.join(".") || "_";
    if (!out[path]) out[path] = issue.message;
  }
  return out;
}

/** Wrap a handler so thrown errors become clean 500s (and are logged). */
export function handleRoute(
  fn: (req: Request, ctx: unknown) => Promise<Response>
) {
  return async (req: Request, ctx: unknown): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      console.error("[route error]", err);
      const message =
        err instanceof Error && !process.env.NODE_ENV?.startsWith("prod")
          ? err.message
          : "Internal server error";
      return fail(message, 500);
    }
  };
}
