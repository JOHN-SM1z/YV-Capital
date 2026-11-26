-- Superseded by notify_org_kind (localized, fixed notification kinds). Removing it means no signed-in
-- user can call an RPC that writes arbitrary notification text.
drop function public.notify_org(uuid, text, text, text);
