-- Private document storage. Objects live at '<startup_id>/<uuid>-<filename>'.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('startup-documents', 'startup-documents', false, 26214400, array[
  'application/pdf','image/png','image/jpeg','text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do nothing;

create policy "docs upload own startup folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'startup-documents' and (
    private.is_yv_staff() or (storage.foldername(name))[1] = private.my_startup_id()::text));

-- read (incl. signed URL creation) only when the matching document row is accessible
create policy "docs read when authorized" on storage.objects for select to authenticated
  using (bucket_id = 'startup-documents' and exists (
    select 1 from public.startup_documents d where d.storage_path = name and public.can_access_document(d.id)));

create policy "docs delete admin" on storage.objects for delete to authenticated
  using (bucket_id = 'startup-documents' and private.is_yv_admin());
