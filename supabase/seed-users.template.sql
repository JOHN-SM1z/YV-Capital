-- Creates the six demo logins. Replace {{DEMO_PASSWORD}} with the value of DEMO_PASSWORD
-- from .env.local before running (never commit the real value).
do $$
declare
  pw text := '{{DEMO_PASSWORD}}';
  u record;
  uid uuid;
begin
  for u in select * from (values
    ('admin@yv.demo',        'Demo Admin',        'yv_admin'::public.user_type, '00000000-0000-4000-8000-000000000001'::uuid, true),
    ('team@yv.demo',         'Demo Team Member',  'yv_team',  '00000000-0000-4000-8000-000000000001'::uuid, false),
    ('investor.a@demo.test', 'Demo Investor A',   'investor', '00000000-0000-4000-8000-0000000000c1'::uuid, true),
    ('investor.b@demo.test', 'Demo Investor B',   'investor', '00000000-0000-4000-8000-0000000000c2'::uuid, true),
    ('founder.a@demo.test',  'Demo Founder A',    'founder',  '00000000-0000-4000-8000-0000000000a1'::uuid, true),
    ('founder.b@demo.test',  'Demo Founder B',    'founder',  '00000000-0000-4000-8000-0000000000a2'::uuid, true)
  ) as t(email, full_name, user_type, org_id, is_org_admin)
  loop
    select id into uid from auth.users where email = u.email;
    if uid is null then
      uid := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, email_change, email_change_token_new, recovery_token)
      values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', u.email,
        extensions.crypt(pw, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.full_name), now(), now(), '', '', '', '');
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), uid, uid::text,
        jsonb_build_object('sub', uid::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now());
    end if;
    insert into public.user_profiles (id, email, full_name, user_type)
    values (uid, u.email, u.full_name, u.user_type) on conflict (id) do nothing;
    insert into public.organization_members (org_id, user_id, is_org_admin)
    values (u.org_id, uid, u.is_org_admin) on conflict (user_id) do nothing;
  end loop;
end $$;
