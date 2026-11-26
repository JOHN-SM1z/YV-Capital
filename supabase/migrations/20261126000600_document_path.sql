-- Investors cannot select startup_documents rows directly (that table holds founder-facing review
-- notes). The download route resolves the storage path through this check-first function.
create or replace function public.document_storage_path(p_document uuid) returns text
language sql stable security definer set search_path = '' as $$
  select d.storage_path from public.startup_documents d
  where d.id = p_document and public.can_access_document(p_document)
$$;
revoke execute on function public.document_storage_path from anon, public;
grant execute on function public.document_storage_path to authenticated;
