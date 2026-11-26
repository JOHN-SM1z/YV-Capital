# Sign-in and sign-up setup

The app supports email and password, email sign-in links, Google, Apple and Microsoft. **Signing up never gives access by itself.** A new account waits on `/pending` until a YV admin approves it in **Team & access → Access requests**. The one exception is a pre-approved email, and only once that email is verified.

Each provider button appears automatically once the provider is switched on in Supabase. Until then it shows as "not set up yet". No code change or deploy is needed.

Supabase project: `zjiiglfeuktwkvcojbdi`. The callback URL that every provider needs is:

```
https://zjiiglfeuktwkvcojbdi.supabase.co/auth/v1/callback
```

## 1. URLs (do this first)

Supabase dashboard → **Authentication → URL Configuration**

- **Site URL:** the production address, for example `https://platform.yoshlarventures.uz`.
- **Redirect URLs:** add `http://localhost:3000/auth/callback` and `https://<production-domain>/auth/callback`.

Also set `NEXT_PUBLIC_SITE_URL` to the production address in hosting.

## 2. Google

1. In [Google Cloud Console](https://console.cloud.google.com/), go to **APIs & Services → OAuth consent screen**. Choose External, use the app name "Yoshlar Ventures", and add `yoshlarventures.uz` as an authorized domain.
2. Go to **Credentials → Create credentials → OAuth client ID → Web application**. Under **Authorized redirect URIs**, add the Supabase callback URL above.
3. In Supabase, go to **Authentication → Sign In / Providers → Google**. Paste the Client ID and Client secret, then enable it.

## 3. Microsoft (Supabase calls it "Azure")

1. In the [Microsoft Entra admin center](https://entra.microsoft.com/), go to **App registrations → New registration**.
   - Supported account types: *Accounts in any organizational directory and personal Microsoft accounts*.
   - Redirect URI (Web): the Supabase callback URL above.
2. Under **Certificates & secrets → New client secret**, copy the secret's **Value**.
3. In Supabase, go to **Authentication → Sign In / Providers → Azure**. Paste the Application (client) ID and the secret. Leave the Azure tenant URL empty so both personal and work accounts can sign in. Then enable it.

The app requests the `email` scope, so the account's email address is returned.

## 4. Apple

This needs a paid Apple Developer account.

1. In [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/), create an **App ID** with *Sign in with Apple*. Then create a **Services ID**; its identifier is the client ID.
2. Configure the Services ID for Sign in with Apple:
   - Domain: `zjiiglfeuktwkvcojbdi.supabase.co`.
   - Return URL: the Supabase callback URL above.
3. Create a **Key** with Sign in with Apple and download the `.p8` file.
4. In Supabase, go to **Authentication → Sign In / Providers → Apple**. Enter the Services ID, Team ID and Key ID, plus the secret generated from the `.p8` key (the Supabase page explains how). Then enable it.

Apple lets people hide their email behind a relay address. Those sign-ups arrive with the relay address, and the admin approves them like any other.

## 5. Email delivery (needed for email sign-up and sign-in links)

Without a custom SMTP server, Supabase Auth only delivers email to addresses that are members of the project's Supabase team, and only a few messages per hour ([docs](https://supabase.com/docs/guides/auth/auth-smtp)). For real users:

- In Supabase, go to **Authentication → SMTP Settings** and enable custom SMTP from a provider such as Resend, Postmark, SES or SendGrid. Use a sender like `no-reply@yoshlarventures.uz` (needs DNS records on that domain).
- Then raise the email limit under **Authentication → Rate Limits**.

Google, Apple and Microsoft sign-in work without SMTP.

## 6. Security settings (recommended before launch)

- **Authentication → Sign In / Providers → Email:** keep **Confirm email** on. Pre-approvals only apply to confirmed emails.
- **Authentication → Attack Protection:** enable leaked-password protection and CAPTCHA (Turnstile or hCaptcha) on sign-up.
- Enable MFA for YV staff.

## How access works

| Situation | Result |
| --- | --- |
| Someone signs up (any method) | Their account is pending: no data, and `/pending` asks for their role and organization. Every admin is notified. |
| An admin approves the request | The admin picks the role and organization; the database checks they fit. The person gets in on their next page load. |
| An admin declines the request | The account stays but has no access. `/pending` says the request was not approved. |
| An email was pre-approved (**Team & access → Pre-approved emails**) | When that email signs up and is verified, the account gets the pre-approved role automatically. |
| The sign-up form or a provider says "I am YV staff" | Ignored for access. It's only shown to the admin as information. |

All of this is enforced in the database (`supabase/migrations/20261126001200_signup_approvals.sql`) and covered by `pnpm test:rls`.
