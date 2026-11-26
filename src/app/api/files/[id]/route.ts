import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";

/**
 * Secure download: authorize in the database (per-document, not per-folder), log the access,
 * then redirect to a 60-second signed URL. Guessing a document id or storage path is useless
 * without access — the signed URL can only be minted by an authorized session.
 */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("Not found", { status: 404 });
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("log_document_access", { p_document: id });
  if (!allowed) return new NextResponse("Not found", { status: 404 });

  const { data: path } = await supabase.rpc("document_storage_path", { p_document: id });
  if (!path) return new NextResponse("Not found", { status: 404 });

  const { data: signed, error } = await supabase.storage.from("startup-documents").createSignedUrl(path, 60, { download: true });
  if (error || !signed) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(signed.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
