-- 0005 — give seeded providers email addresses and channel prefs so email
-- works as a real routing channel. Idempotent: safe to run on an already-seeded
-- database; a no-op if 0003 hasn't run yet (0003 already carries these).
-- Point one provider's email at an inbox you control to see a live email alert:
--   update public.providers set email='you@yourinbox.com', preferred_channel='email'
--     where name='Karibu Catering Co.';

update public.providers set email='mercy@savannafresh.co.ke', preferred_channel='whatsapp', channels='{"whatsapp":true,"sms":true,"email":true}'::jsonb where name='Savanna Fresh Caterers';
update public.providers set email='brian@mahuaevents.co.ke', preferred_channel='whatsapp', channels='{"whatsapp":true,"sms":true,"email":true}'::jsonb where name='Mahua Events & Tents';
update public.providers set email='kevin@tononokasound.co.ke', preferred_channel='sms', channels='{"whatsapp":false,"sms":true,"email":true}'::jsonb where name='Tononoka Sound Systems';
update public.providers set email='aisha@zainadecor.co.ke', preferred_channel='whatsapp', channels='{"whatsapp":true,"sms":true,"email":true}'::jsonb where name='Zaina Décor Studio';
update public.providers set email='peter@karibucatering.co.ke', preferred_channel='email', channels='{"whatsapp":true,"sms":true,"email":true}'::jsonb where name='Karibu Catering Co.';
update public.providers set email='faith@junctionrentals.co.ke', preferred_channel='email', channels='{"whatsapp":true,"sms":true,"email":true}'::jsonb where name='Junction Rentals';
update public.providers set email='dennis@lumenphoto.co.ke', preferred_channel='whatsapp', channels='{"whatsapp":true,"sms":true,"email":true}'::jsonb where name='Lumen Photo & Film';
update public.providers set email='caroline@sweetridge.co.ke', preferred_channel='whatsapp', channels='{"whatsapp":true,"sms":true,"email":true}'::jsonb where name='Sweet Ridge Bakers';
update public.providers set email='joseph@askarisecurity.co.ke', preferred_channel='sms', channels='{"whatsapp":false,"sms":true,"email":true}'::jsonb where name='Askari Event Security';
update public.providers set email='samuel@rongaipower.co.ke', preferred_channel='sms', channels='{"whatsapp":true,"sms":true,"email":true}'::jsonb where name='Rongai Power & Light';
