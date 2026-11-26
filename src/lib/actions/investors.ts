"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser, STAFF } from "@/lib/auth";
import { getDictionary } from "@/i18n/server";
import { dbError, fail, ok, type ActionState } from "@/lib/action-state";
import { parseMoney, str } from "@/lib/format";
import { Constants } from "@/lib/database.types";

const E = Constants.public.Enums;
const list = (fd: FormData, key: string) => fd.getAll(key).map(String).filter(Boolean);
const priorityLevel = z.enum(E.priority_level);

type CheckRange = { ok: true; min: number | null; max: number | null } | { ok: false; error: "amount" | "checkRange" };

function readCheckRange(fd: FormData): CheckRange {
  const min = parseMoney(fd.get("min_check"));
  const max = parseMoney(fd.get("max_check"));
  if (Number.isNaN(min) || Number.isNaN(max)) return { ok: false, error: "amount" };
  if (min != null && max != null && min > max) return { ok: false, error: "checkRange" };
  return { ok: true, min, max };
}

export async function createInvestor(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const t = await getDictionary();
  const name = str(fd.get("name"));
  const category = z.enum(E.investor_category).safeParse(fd.get("category"));
  if (!name || !category.success) return fail(t.validation.nameAndType);
  const range = readCheckRange(fd);
  if (!range.ok) return fail(t.errors[range.error]);

  const supabase = await createClient();
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ type: "investor", name, website: str(fd.get("website")), country: str(fd.get("country")) })
    .select("id")
    .single();
  if (orgError || !org) return dbError(t, orgError);

  const { data: investor, error: invError } = await supabase
    .from("investors")
    .insert({ org_id: org.id, category: category.data, headquarters: str(fd.get("headquarters")), thesis: str(fd.get("thesis")), created_by: user.id })
    .select("id")
    .single();
  if (invError || !investor) return dbError(t, invError);

  const [prefs, rel] = await Promise.all([
    supabase.from("investor_preferences").insert({
      investor_id: investor.id,
      sectors: list(fd, "sectors"),
      stages: list(fd, "stages"),
      geographies: list(fd, "geographies"),
      min_check: range.min,
      max_check: range.max,
      central_asia_interest: fd.get("central_asia_interest") === "on",
      updated_by: user.id,
    }),
    supabase.from("investor_relationships").insert({ investor_id: investor.id, owner_id: user.id, updated_by: user.id }),
  ]);
  if (prefs.error || rel.error) return dbError(t, prefs.error ?? rel.error);

  revalidatePath("/admin/investors");
  redirect(`/admin/investors/${investor.id}`);
}

export async function updateRelationship(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const t = await getDictionary();
  const parsed = z
    .object({
      investor_id: z.uuid(),
      status: z.enum(E.relationship_status),
      priority: priorityLevel,
      owner_id: z.uuid().nullable(),
      next_follow_up_at: z.iso.date().nullable(),
      last_contact_at: z.iso.date().nullable(),
    })
    .safeParse({
      investor_id: fd.get("investor_id"),
      status: fd.get("status"),
      priority: fd.get("priority"),
      owner_id: str(fd.get("owner_id")),
      next_follow_up_at: str(fd.get("next_follow_up_at")),
      last_contact_at: str(fd.get("last_contact_at")),
    });
  if (!parsed.success) return fail(t.validation.relationshipFields);
  const tags = (str(fd.get("tags")) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const supabase = await createClient();
  const { error } = await supabase.from("investor_relationships").upsert({ ...parsed.data, tags, updated_by: user.id });
  if (error) return dbError(t, error);
  revalidatePath(`/admin/investors/${parsed.data.investor_id}`);
  return ok(t.msg.relationshipUpdated);
}

/** YV staff (any investor) and investor org admins (own organization, enforced by RLS). */
export async function updatePreferences(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(["yv_admin", "yv_team", "investor"]);
  const t = await getDictionary();
  const investorId = z.uuid().safeParse(fd.get("investor_id"));
  if (!investorId.success) return fail(t.validation.missingRecord);
  const range = readCheckRange(fd);
  if (!range.ok) return fail(t.errors[range.error]);
  const coInvest = priorityLevel.safeParse(fd.get("co_invest_appetite"));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("investor_preferences")
    .upsert({
      investor_id: investorId.data,
      sectors: list(fd, "sectors"),
      stages: list(fd, "stages"),
      geographies: list(fd, "geographies"),
      min_check: range.min,
      max_check: range.max,
      central_asia_interest: fd.get("central_asia_interest") === "on",
      co_invest_appetite: coInvest.success ? coInvest.data : null,
      updated_by: user.id,
    })
    .select("investor_id");
  if (error || !data?.length) return dbError(t, error, t.validation.cantEdit);
  revalidatePath("/admin/investors", "layout");
  revalidatePath("/investor/organization");
  return ok(t.msg.preferencesSaved);
}

export async function updateInvestorProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(["yv_admin", "yv_team", "investor"]);
  const t = await getDictionary();
  const investorId = z.uuid().safeParse(fd.get("investor_id"));
  if (!investorId.success) return fail(t.validation.missingRecord);
  const category = z.enum(E.investor_category).safeParse(fd.get("category"));
  const website = str(fd.get("website"));
  if (website && !website.startsWith("https://")) return fail(t.errors.url);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("investors")
    .update({
      headquarters: str(fd.get("headquarters")),
      thesis: str(fd.get("thesis")),
      description: str(fd.get("description")),
      portfolio_highlights: str(fd.get("portfolio_highlights")),
      ...(category.success ? { category: category.data } : {}),
      updated_by: user.id,
    })
    .eq("id", investorId.data)
    .select("org_id")
    .single();
  if (error || !data) return dbError(t, error, t.validation.cantEdit);

  const name = str(fd.get("name"));
  const { error: orgError } = await supabase
    .from("organizations")
    .update({ website, country: str(fd.get("country")), ...(name ? { name } : {}) })
    .eq("id", data.org_id);
  if (orgError) return dbError(t, orgError);

  revalidatePath("/admin/investors", "layout");
  revalidatePath("/investor/organization");
  return ok(t.msg.profileSaved);
}

export async function addContact(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(["yv_admin", "yv_team", "investor"]);
  const t = await getDictionary();
  const parsed = z
    .object({
      investor_id: z.uuid(),
      full_name: z.string().min(1).max(200),
      email: z.email().nullable(),
      title: z.string().max(200).nullable(),
      linkedin: z.url({ protocol: /^https$/ }).nullable(),
    })
    .safeParse({
      investor_id: fd.get("investor_id"),
      full_name: str(fd.get("full_name")),
      email: str(fd.get("email")),
      title: str(fd.get("title")),
      linkedin: str(fd.get("linkedin")),
    });
  if (!parsed.success) return fail(t.validation.contactFields);
  const supabase = await createClient();
  const { error } = await supabase.from("investor_contacts").insert(parsed.data);
  if (error) return dbError(t, error);
  revalidatePath(`/admin/investors/${parsed.data.investor_id}`);
  revalidatePath("/investor/organization");
  return ok(t.msg.contactAdded);
}

const NOTE_PATHS = { investor: "investors", startup: "startups", opportunity: "opportunities" } as const;

export async function addNote(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const t = await getDictionary();
  const parsed = z
    .object({ entity_type: z.enum(["investor", "startup", "opportunity"]), entity_id: z.uuid(), body: z.string().min(1).max(10_000) })
    .safeParse({ entity_type: fd.get("entity_type"), entity_id: fd.get("entity_id"), body: str(fd.get("body")) });
  if (!parsed.success) return fail(t.validation.writeNote);
  const supabase = await createClient();
  const { error } = await supabase.from("notes").insert({ ...parsed.data, is_assessment: fd.get("is_assessment") === "on", created_by: user.id });
  if (error) return dbError(t, error);
  revalidatePath(`/admin/${NOTE_PATHS[parsed.data.entity_type]}/${parsed.data.entity_id}`);
  return ok(t.msg.noteSaved);
}
