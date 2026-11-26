"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser, STAFF } from "@/lib/auth";
import { getDictionary } from "@/i18n/server";
import { dbError, fail, logServerError, ok, type ActionState } from "@/lib/action-state";
import { parseMoney, str } from "@/lib/format";
import { isFundingStage, isMetricKey, isRecordKind, isRoundType } from "@/lib/labels";
import { notifyOrg } from "@/lib/notify";
import { DEFAULT_READINESS } from "@/lib/readiness";
import { Constants } from "@/lib/database.types";

const E = Constants.public.Enums;
const httpsUrl = z.url({ protocol: /^https$/ });

function revalidateStartup(id: string) {
  revalidatePath("/startup", "layout");
  revalidatePath(`/admin/startups/${id}`);
}

export async function createStartup(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const t = await getDictionary();
  const name = str(fd.get("name"));
  if (!name) return fail(t.validation.startupName);
  const website = str(fd.get("website"));
  if (website && !httpsUrl.safeParse(website).success) return fail(t.errors.url);
  const stage = fd.get("funding_stage");
  const country = str(fd.get("country")) ?? "Uzbekistan";

  const supabase = await createClient();
  const { data: org, error: orgError } = await supabase.from("organizations").insert({ type: "startup", name, website, country }).select("id").single();
  if (orgError || !org) return dbError(t, orgError);
  const { data: startup, error } = await supabase
    .from("startups")
    .insert({
      org_id: org.id,
      name,
      website,
      country,
      sector: str(fd.get("sector")),
      one_liner: str(fd.get("one_liner")),
      funding_stage: isFundingStage(stage) ? stage : null,
      is_portfolio: fd.get("is_portfolio") === "on",
      owner_id: user.id,
      source: "Added by YV",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !startup) return dbError(t, error);

  const { error: tasksError } = await supabase
    .from("startup_readiness_tasks")
    .insert(DEFAULT_READINESS.map(({ title }, i) => ({ startup_id: startup.id, title, sort_order: i + 1, created_by: user.id })));
  if (tasksError) logServerError("startups.readiness", tasksError);

  revalidatePath("/admin/startups");
  redirect(`/admin/startups/${startup.id}`);
}

export async function changeStage(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(STAFF);
  const t = await getDictionary();
  const parsed = z.object({ id: z.uuid(), stage: z.enum(E.pipeline_stage) }).safeParse({ id: fd.get("id"), stage: fd.get("stage") });
  if (!parsed.success) return fail(t.validation.pickStage);
  const supabase = await createClient();
  const { error } = await supabase.from("startups").update({ stage: parsed.data.stage }).eq("id", parsed.data.id);
  if (error) return dbError(t, error);
  revalidatePath(`/admin/startups/${parsed.data.id}`);
  revalidatePath("/admin/startups");
  return ok(t.msg.stageUpdated);
}

export async function assignStartupOwner(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(STAFF);
  const t = await getDictionary();
  const parsed = z.object({ id: z.uuid(), owner_id: z.uuid().nullable() }).safeParse({ id: fd.get("id"), owner_id: str(fd.get("owner_id")) });
  if (!parsed.success) return fail(t.validation.missingRecord);
  const supabase = await createClient();
  const { error } = await supabase.from("startups").update({ owner_id: parsed.data.owner_id }).eq("id", parsed.data.id);
  if (error) return dbError(t, error);
  revalidatePath(`/admin/startups/${parsed.data.id}`);
  return ok(t.msg.ownerUpdated);
}

/** Founders (own startup) and staff. YV-managed fields are protected by a database trigger. */
export async function updateStartupProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(["yv_admin", "yv_team", "founder"]);
  const t = await getDictionary();
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) return fail(t.validation.missingRecord);
  const website = str(fd.get("website"));
  if (website && !httpsUrl.safeParse(website).success) return fail(t.errors.url);
  const stage = fd.get("funding_stage");
  const int = (key: string, min: number, max: number) => {
    const n = Number.parseInt(String(fd.get(key) ?? ""), 10);
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("startups")
    .update({
      website,
      headquarters: str(fd.get("headquarters")),
      sector: str(fd.get("sector")),
      one_liner: str(fd.get("one_liner")),
      description: str(fd.get("description")),
      problem: str(fd.get("problem")),
      solution: str(fd.get("solution")),
      target_market: str(fd.get("target_market")),
      business_model: str(fd.get("business_model")),
      team_size: int("team_size", 0, 100_000),
      founded_year: int("founded_year", 1990, 2100),
      funding_stage: isFundingStage(stage) ? stage : null,
      updated_by: user.id,
    })
    .eq("id", id.data)
    .select("id");
  if (error || !data?.length) return dbError(t, error, t.validation.cantEdit);
  revalidateStartup(id.data);
  return ok(t.msg.companySaved);
}

export async function addMetric(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(["yv_admin", "yv_team", "founder"]);
  const t = await getDictionary();
  const staff = user.userType !== "founder";
  const parsed = z
    .object({
      startup_id: z.uuid(),
      metric_key: z.string().refine(isMetricKey),
      value: z.coerce.number().finite(),
      unit: z.enum(["USD", "% MoM", "% YoY", "count"]),
      period: z.string().min(1).max(40),
      source: z.string().min(1).max(300),
    })
    .safeParse({
      startup_id: fd.get("startup_id"),
      metric_key: fd.get("metric_key"),
      value: fd.get("value"),
      unit: fd.get("unit"),
      period: str(fd.get("period")),
      source: str(fd.get("source")) ?? (staff ? null : t.metrics.sourceFounderPh),
    });
  if (!parsed.success) return fail(t.validation.metricFields);
  const verified = staff && fd.get("verified") === "on";
  const supabase = await createClient();
  const { error } = await supabase.from("startup_metrics").insert({
    ...parsed.data,
    verification: verified ? "yv_verified" : "founder_submitted",
    verified_by: verified ? user.id : null,
    created_by: user.id,
  });
  if (error) return dbError(t, error);
  revalidateStartup(parsed.data.startup_id);
  return ok(t.msg.metricAdded);
}

export async function verifyMetric(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const t = await getDictionary();
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) return fail(t.validation.missingRecord);
  const verdict = fd.get("verdict") === "reject" ? "rejected" : "yv_verified";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("startup_metrics")
    .update({ verification: verdict, verified_by: user.id })
    .eq("id", id.data)
    .select("startup_id")
    .single();
  if (error || !data) return dbError(t, error);
  revalidatePath(`/admin/startups/${data.startup_id}`);
  return ok(verdict === "yv_verified" ? t.msg.metricVerified : t.msg.metricRejected);
}

export async function saveFundraising(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(["yv_admin", "yv_team", "founder"]);
  const t = await getDictionary();
  const startupId = z.uuid().safeParse(fd.get("startup_id"));
  const round = fd.get("round_type");
  if (!startupId.success || !isRoundType(round)) return fail(t.validation.pickRound);
  const [target, minTicket, maxTicket, valuation] = ["target_amount", "min_ticket", "max_ticket", "valuation_expectation"].map((k) => parseMoney(fd.get(k)));
  if ([target, minTicket, maxTicket, valuation].some((v) => Number.isNaN(v))) return fail(t.errors.amount);
  if (minTicket != null && maxTicket != null && minTicket > maxTicket) return fail(t.validation.ticketRange);
  const supabase = await createClient();
  const { error } = await supabase.from("startup_fundraising").insert({
    startup_id: startupId.data,
    round_type: round,
    target_amount: target,
    min_ticket: minTicket,
    max_ticket: maxTicket,
    valuation_expectation: valuation,
    use_of_funds: str(fd.get("use_of_funds")),
    current_investors: str(fd.get("current_investors")),
    previous_funding: str(fd.get("previous_funding")),
    verification: user.userType !== "founder" && fd.get("verified") === "on" ? "yv_verified" : "founder_submitted",
    created_by: user.id,
  });
  if (error) return dbError(t, error);
  revalidateStartup(startupId.data);
  return ok(t.msg.fundraisingSaved);
}

export async function addFounder(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(["yv_admin", "yv_team", "founder"]);
  const t = await getDictionary();
  const parsed = z
    .object({
      startup_id: z.uuid(),
      full_name: z.string().min(1).max(200),
      role: z.string().max(100).nullable(),
      linkedin: httpsUrl.nullable(),
      bio: z.string().max(2000).nullable(),
    })
    .safeParse({
      startup_id: fd.get("startup_id"),
      full_name: str(fd.get("full_name")),
      role: str(fd.get("role")),
      linkedin: str(fd.get("linkedin")),
      bio: str(fd.get("bio")),
    });
  if (!parsed.success) return fail(t.validation.founderFields);
  const supabase = await createClient();
  const { error } = await supabase.from("startup_founders").insert(parsed.data);
  if (error) return dbError(t, error);
  revalidateStartup(parsed.data.startup_id);
  return ok(t.msg.teamMemberAdded);
}

export async function toggleReadinessTask(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(["yv_admin", "yv_team", "founder"]);
  const t = await getDictionary();
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) return fail(t.validation.missingRecord);
  const done = fd.get("done") === "true";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("startup_readiness_tasks")
    .update({ is_done: done, completed_at: done ? new Date().toISOString() : null })
    .eq("id", id.data)
    .select("startup_id")
    .single();
  if (error || !data) return dbError(t, error);
  revalidateStartup(data.startup_id);
  return ok();
}

export async function addReadinessTask(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const t = await getDictionary();
  const startupId = z.uuid().safeParse(fd.get("startup_id"));
  const title = str(fd.get("title"));
  if (!startupId.success || !title) return fail(t.validation.writeTask);
  const supabase = await createClient();
  const { error } = await supabase.from("startup_readiness_tasks").insert({
    startup_id: startupId.data,
    title,
    description: str(fd.get("description")),
    due_date: str(fd.get("due_date")),
    sort_order: 100,
    created_by: user.id,
  });
  if (error) return dbError(t, error);
  revalidateStartup(startupId.data);
  return ok(t.msg.taskAdded);
}

export async function createStartupRequest(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const t = await getDictionary();
  const startupId = z.uuid().safeParse(fd.get("startup_id"));
  const title = str(fd.get("title"));
  if (!startupId.success || !title) return fail(t.validation.requestTitle);
  const supabase = await createClient();
  const { data: startup, error: readError } = await supabase.from("startups").select("org_id").eq("id", startupId.data).single();
  if (readError || !startup) return dbError(t, readError, t.validation.companyNotFound);
  const { error } = await supabase
    .from("startup_requests")
    .insert({ startup_id: startupId.data, title, body: str(fd.get("body")), due_date: str(fd.get("due_date")), created_by: user.id });
  if (error) return dbError(t, error);
  await notifyOrg(supabase, startup.org_id, "new_request", "/startup/requests", { title });
  revalidateStartup(startupId.data);
  return ok(t.msg.requestSent);
}

export async function reviewDocument(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const t = await getDictionary();
  const parsed = z.object({ id: z.uuid(), status: z.enum(E.doc_status) }).safeParse({ id: fd.get("id"), status: fd.get("status") });
  if (!parsed.success) return fail(t.validation.pickStatus);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("startup_documents")
    .update({ status: parsed.data.status, review_note: str(fd.get("review_note")), reviewed_by: user.id })
    .eq("id", parsed.data.id)
    .select("startup_id, title, startups(org_id)")
    .single();
  if (error || !data) return dbError(t, error);
  const status = parsed.data.status;
  if (data.startups && (status === "verified" || status === "rejected" || status === "info_required")) {
    await notifyOrg(supabase, data.startups.org_id, status === "verified" ? "doc_verified" : "doc_attention", "/startup/documents", { title: data.title });
  }
  revalidateStartup(data.startup_id);
  return ok(t.msg.documentUpdated);
}

export async function addPublicRecord(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const t = await getDictionary();
  const kind = fd.get("kind");
  const amount = parseMoney(fd.get("amount_usd"));
  const parsed = z
    .object({
      startup_id: z.uuid(),
      title: z.string().min(3).max(300),
      url: httpsUrl,
      publisher: z.string().min(1).max(120),
      summary: z.string().min(5).max(600),
      published_on: z.iso.date().nullable(),
    })
    .safeParse({
      startup_id: fd.get("startup_id"),
      title: str(fd.get("title")),
      url: str(fd.get("url")),
      publisher: str(fd.get("publisher")),
      summary: str(fd.get("summary")),
      published_on: str(fd.get("published_on")),
    });
  if (!parsed.success || !isRecordKind(kind)) return fail(t.validation.recordFields);
  if (Number.isNaN(amount)) return fail(t.errors.amount);
  const supabase = await createClient();
  const { error } = await supabase.from("startup_public_records").insert({ ...parsed.data, kind, amount_usd: amount, added_by: user.id });
  if (error) return dbError(t, error);
  revalidateStartup(parsed.data.startup_id);
  revalidatePath("/investor/portfolio", "layout");
  return ok(t.msg.recordAdded);
}

export async function saveOutlook(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const t = await getDictionary();
  const parsed = z
    .object({
      startup_id: z.uuid(),
      likelihood: z.enum(E.round_likelihood),
      expected_window: z.string().max(60).nullable(),
      rationale: z.string().min(5).max(2000),
    })
    .safeParse({
      startup_id: fd.get("startup_id"),
      likelihood: fd.get("likelihood"),
      expected_window: str(fd.get("expected_window")),
      rationale: str(fd.get("rationale")),
    });
  if (!parsed.success) return fail(t.validation.outlookFields);
  const signals = (str(fd.get("signals")) ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
  const supabase = await createClient();
  const { error } = await supabase
    .from("startup_round_outlook")
    .upsert({ ...parsed.data, signals, assessed_by: user.id, assessed_at: new Date().toISOString() });
  if (error) return dbError(t, error);
  revalidatePath(`/admin/startups/${parsed.data.startup_id}`);
  revalidatePath("/admin/next-rounds");
  return ok(t.msg.outlookSaved);
}
