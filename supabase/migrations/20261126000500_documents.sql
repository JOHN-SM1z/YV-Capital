-- Document download logging + cleanup of rejected uploads.

-- Records a download; returns false (and logs nothing) when the caller has no access.
create or replace function public.log_document_access(p_document uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_access_document(p_document) then return false; end if;
  insert into public.document_access_logs (document_id, user_id) values (p_document, auth.uid());
  return true;
end $$;
revoke execute on function public.log_document_access from anon, public;
grant execute on function public.log_document_access to authenticated;

-- An uploader may delete an object in their own startup folder only while no document row
-- references it (used when server-side validation rejects a file after upload).
create policy "docs delete own unregistered" on storage.objects for delete to authenticated
  using (bucket_id = 'startup-documents'
    and (storage.foldername(name))[1] = private.my_startup_id()::text
    and not exists (select 1 from public.startup_documents d where d.storage_path = name));

-- Uploaders need to read back their own unregistered object for signature validation.
create policy "docs read own unregistered" on storage.objects for select to authenticated
  using (bucket_id = 'startup-documents'
    and (storage.foldername(name))[1] = private.my_startup_id()::text
    and not exists (select 1 from public.startup_documents d where d.storage_path = name));
