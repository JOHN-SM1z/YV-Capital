import { redirect } from "next/navigation";
import { getMyAccessRequest, getSessionUser, hasAuthSession, homeFor } from "@/lib/auth";
import { signOut, submitAccessRequest } from "@/lib/actions/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AuthLayout } from "@/components/auth-layout";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/i18n/server";
import { fmt } from "@/i18n/config";

export async function generateMetadata() {
  return { title: (await getDictionary()).access.pendingTitle };
}

/** Signed in, but without platform access: pending approval, declined, or a deactivated member. */
export default async function PendingPage() {
  const user = await getSessionUser();
  if (user) redirect(homeFor(user.userType));
  if (!(await hasAuthSession())) redirect("/login");
  const [t, request, supabase] = await Promise.all([getDictionary(), getMyAccessRequest(), createClient()]);
  const a = t.access;
  const { data: claims } = await supabase.auth.getClaims();
  const email = typeof claims?.claims.email === "string" ? claims.claims.email : "";

  let title = t.states.inactiveTitle;
  let body = t.states.inactiveBody;
  if (request?.status === "pending") [title, body] = [a.pendingTitle, a.pendingBody];
  if (request?.status === "declined") [title, body] = [a.declinedTitle, a.declinedBody];
  // Google/Apple/Microsoft sign-ups arrive without role and organization: ask for them.
  const needsDetails = request?.status === "pending" && (!request.requested_role || !request.organization_name);

  return (
    <AuthLayout>
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-ink-2">{body}</p>
      {email && <p className="mt-4 text-xs text-muted">{fmt(a.signedInAs, { email })}</p>}

      {request?.status === "pending" && (
        <div className="mt-6 rounded-xl border border-line bg-card p-5">
          <h3 className="font-semibold">{a.completeTitle}</h3>
          <p className="mt-0.5 text-sm text-muted">{a.completeBody}</p>
          <ActionForm action={submitAccessRequest} className="mt-4 space-y-3">
            <Field label={a.fullName}>
              <Input name="full_name" defaultValue={request.full_name} required minLength={2} maxLength={200} />
            </Field>
            <Field label={a.iAm}>
              <Select name="requested_role" required defaultValue={request.requested_role === "founder" ? "founder" : "investor"}>
                <option value="investor">{a.roleInvestor}</option>
                <option value="founder">{a.roleFounder}</option>
              </Select>
            </Field>
            <Field label={a.organization}>
              <Input name="organization_name" defaultValue={request.organization_name ?? ""} required minLength={2} maxLength={200} />
            </Field>
            <Field label={a.message}>
              <Textarea name="message" defaultValue={request.message ?? ""} maxLength={1000} className="min-h-20" placeholder={a.messagePh} />
            </Field>
            <SubmitButton variant={needsDetails ? "primary" : "secondary"} className="w-full">
              {a.send}
            </SubmitButton>
          </ActionForm>
        </div>
      )}

      <form action={signOut} className="mt-6">
        <button className="text-sm font-medium text-brand-600 hover:underline">{t.common.signOut}</button>
      </form>
    </AuthLayout>
  );
}
