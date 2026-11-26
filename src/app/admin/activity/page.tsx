import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Card, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { rows } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import type { Json } from "@/lib/database.types";

export async function generateMetadata() {
  return { title: (await getI18n()).t.nav.activity };
}

const hasDetails = (d: Json) => !!d && typeof d === "object" && Object.keys(d).length > 0;

export default async function ActivityPage() {
  await requireUser(["yv_admin"]);
  const supabase = await createClient();
  const { t, locale } = await getI18n();
  const x = t.activity;
  const [logsRes, profilesRes, downloadsRes] = await Promise.all([
    supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("user_profiles").select("id, full_name, email"),
    supabase.from("document_access_logs").select("id, created_at, user_id, startup_documents(title)").order("created_at", { ascending: false }).limit(50),
  ]);
  const logs = rows(logsRes, "audit logs");
  const downloads = rows(downloadsRes, "downloads");
  const who = new Map(rows(profilesRes, "profiles").map((p) => [p.id, p.full_name || p.email]));

  return (
    <>
      <PageHeader title={x.title} description={x.subtitle} />
      <Card className="mb-6">
        {logs.length === 0 ? (
          <EmptyState title={x.none} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{x.colWhen}</Th>
                <Th>{x.colWho}</Th>
                <Th>{x.colAction}</Th>
                <Th>{x.colDetails}</Th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <Td className="whitespace-nowrap text-ink-2">{dateTime(l.created_at, locale)}</Td>
                  <Td>{l.actor_id ? (who.get(l.actor_id) ?? x.unknownUser) : x.system}</Td>
                  <Td className="font-mono text-xs">{l.action}</Td>
                  <Td className="max-w-md truncate font-mono text-xs text-muted">
                    {l.entity_type} {l.entity_id?.slice(0, 8)} {hasDetails(l.details) ? JSON.stringify(l.details) : ""}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <Card>
        <CardHeader title={x.downloads} />
        {downloads.length === 0 ? (
          <EmptyState title={x.noDownloads} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{x.colWhen}</Th>
                <Th>{x.colWho}</Th>
                <Th>{x.colDocument}</Th>
              </tr>
            </thead>
            <tbody>
              {downloads.map((d) => (
                <tr key={d.id}>
                  <Td className="text-ink-2">{dateTime(d.created_at, locale)}</Td>
                  <Td>{d.user_id ? (who.get(d.user_id) ?? x.externalUser) : "—"}</Td>
                  <Td>{d.startup_documents?.title}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
