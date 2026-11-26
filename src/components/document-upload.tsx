"use client";

import { useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { newUploadPath, registerDocument } from "@/lib/actions/portal";
import { ACCEPT_ATTR, validateUpload } from "@/lib/uploads";
import { DOC_TYPES } from "@/lib/labels";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { Button, Field, Input, Select } from "@/components/ui";

type Props = {
  /** Only the strings this component needs, passed from the server. */
  strings: Dictionary["upload"];
  docTypeLabels: Dictionary["enums"]["doc_type"];
};

/**
 * Uploads go straight from the browser to private storage, so large decks don't pass through a
 * size-limited server function. Storage RLS only allows the founder's own folder; the server then
 * re-checks the real file content before registering it.
 */
export function DocumentUpload({ strings, docTypeLabels }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function upload(form: FormData, file: File): Promise<string> {
    const head = new Uint8Array(await file.slice(0, 512).arrayBuffer());
    const check = validateUpload({ name: file.name, size: file.size, head });
    if (!check.ok) throw new Error(strings[check.error]);

    const { path, error } = await newUploadPath(file.name);
    if (!path) throw new Error(error ?? strings.start);
    const result = await createClient().storage.from("startup-documents").upload(path, file, { contentType: check.mime, upsert: false });
    if (result.error) throw new Error(strings.failed);

    const fd = new FormData();
    fd.set("storage_path", path);
    fd.set("title", String(form.get("title") || file.name));
    fd.set("doc_type", String(form.get("doc_type")));
    const registered = await registerDocument({}, fd);
    if (registered.error) throw new Error(registered.error);
    return registered.message ?? "";
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setMessage({ ok: false, text: strings.choose });
      return;
    }
    setBusy(true);
    try {
      setMessage({ ok: true, text: await upload(form, file) });
      formRef.current?.reset();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : strings.failed });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <Field label={strings.docType}>
        <Select name="doc_type" defaultValue="pitch_deck">
          {DOC_TYPES.map((type) => (
            <option key={type} value={type}>
              {docTypeLabels[type]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={strings.titleOptional}>
        <Input name="title" placeholder={strings.titlePlaceholder} />
      </Field>
      <Field label={strings.file} hint={strings.fileHint} className="sm:col-span-2">
        <input
          name="file"
          type="file"
          accept={ACCEPT_ATTR}
          required
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-card file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-surface"
        />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={busy}>
          {busy ? strings.uploading : strings.upload}
        </Button>
        {message && (
          <p role={message.ok ? "status" : "alert"} className={`mt-2 rounded-md px-3 py-2 text-sm ${message.ok ? "bg-pos-50 text-pos" : "bg-neg-50 text-neg"}`}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
