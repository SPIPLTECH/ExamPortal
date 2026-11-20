import { AuditLog } from "@/models/AuditLog";
import { connectDB } from "./db";

export type AuditInput = {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
};

/**
 * Record an audit event. Never throws into the caller's happy path — audit
 * failures are logged but must not break the user action that triggered them.
 */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await connectDB();
    await AuditLog.create({
      actor: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? null,
      ip: input.ip ?? null,
    });
  } catch (err) {
    console.error("[audit] failed to record event", input.action, err);
  }
}

/** Extract the best-effort client IP from a request's headers. */
export function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip");
}
