import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { logServerError } from "@/lib/action-state";

export type NotificationKind = keyof Dictionary["notif"];

/**
 * Notifies every active member of an organization. A failed notification must never undo the
 * action that triggered it, so errors are logged rather than returned.
 */
export async function notifyOrg(
  supabase: ServerClient,
  orgId: string,
  kind: NotificationKind,
  link: string,
  params: Record<string, string> = {},
): Promise<void> {
  const { error } = await supabase.rpc("notify_org_kind", { p_org: orgId, p_kind: kind, p_params: params, p_link: link });
  if (error) logServerError(`notify.${kind}`, error);
}

/** Writes an audit entry for a staff action; failures are logged, not surfaced. */
export async function audit(supabase: ServerClient, action: string, entityType: string, entityId: string, details: Record<string, string> = {}): Promise<void> {
  const { error } = await supabase.rpc("log_audit", { p_action: action, p_entity_type: entityType, p_entity_id: entityId, p_details: details });
  if (error) logServerError(`audit.${action}`, error);
}
