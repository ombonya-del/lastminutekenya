-- LastMinuteKenya — optional network seed (providers + assessors only).
-- Idempotent: only seeds when the table is empty, so re-running never duplicates.

insert into public.providers (name, lead, phone, email, categories, base_lat, base_lng, area, rating, jobs_done, readiness, capacity, response_mins, channels, preferred_channel, blurb)
select name, lead, phone, email, categories, base_lat, base_lng, area, rating, jobs_done, readiness, capacity, response_mins, channels, preferred_channel, blurb from (values
  ('Savanna Fresh Caterers', 'Mercy Achieng', '+254712000111', 'mercy@savannafresh.co.ke', '{"catering","cake"}'::text[], -1.2755, 36.7649, 'Lavington', 4.8, 214, 'ready', 400, 35, '{"whatsapp":true,"sms":true,"email":true}'::jsonb, 'whatsapp', 'Buffet & plated service, halal options. Emergency 300-plate turnaround.'),
  ('Mahua Events & Tents', 'Brian Kiptoo', '+254712000222', 'brian@mahuaevents.co.ke', '{"tents","decor"}'::text[], -1.2246, 36.9008, 'Kasarani', 4.5, 158, 'ready', 800, 50, '{"whatsapp":true,"sms":true,"email":true}'::jsonb, 'whatsapp', 'Stretch & pagoda tents, chairs, drapes. Fleet stationed on Thika Road.'),
  ('Tononoka Sound Systems', 'Kevin Otieno', '+254712000333', 'kevin@tononokasound.co.ke', '{"sound","power"}'::text[], -1.3217, 36.8886, 'Embakasi', 4.3, 91, 'busy', 1000, 45, '{"whatsapp":false,"sms":true,"email":true}'::jsonb, 'sms', 'Line-array PA, DJ rigs, 20–60kVA generators with fuel.'),
  ('Zaina Décor Studio', 'Aisha Noor', '+254712000444', 'aisha@zainadecor.co.ke', '{"decor"}'::text[], -1.2896, 36.788900000000005, 'Kilimani', 4.7, 176, 'ready', 500, 30, '{"whatsapp":true,"sms":true,"email":true}'::jsonb, 'whatsapp', 'Floral, backdrops, table styling. Studio 8 minutes from Yaya.'),
  ('Karibu Catering Co.', 'Peter Mwangi', '+254712000555', 'peter@karibucatering.co.ke', '{"catering"}'::text[], -1.3167000000000002, 36.7106, 'Karen', 4.2, 63, 'ready', 250, 40, '{"whatsapp":true,"sms":true,"email":true}'::jsonb, 'email', 'Nyama choma & buffet specialists for the Karen–Langata belt.'),
  ('Junction Rentals', 'Faith Wambui', '+254712000666', 'faith@junctionrentals.co.ke', '{"tents","transport"}'::text[], -1.2668, 36.8035, 'Westlands', 4.1, 88, 'ready', 600, 55, '{"whatsapp":true,"sms":true,"email":true}'::jsonb, 'email', 'Chairs, tables, marquees + 14-seater and truck logistics.'),
  ('Lumen Photo & Film', 'Dennis Kariuki', '+254712000777', 'dennis@lumenphoto.co.ke', '{"photo"}'::text[], -1.2854, 36.8182, 'CBD', 4.6, 132, 'ready', 3, 25, '{"whatsapp":true,"sms":true,"email":true}'::jsonb, 'whatsapp', 'Same-day photo + film crews, drone on request.'),
  ('Sweet Ridge Bakers', 'Caroline Njeri', '+254712000888', 'caroline@sweetridge.co.ke', '{"cake"}'::text[], -1.2023, 36.7843, 'Ruaka', 4.4, 77, 'ready', 60, 60, '{"whatsapp":true,"sms":true,"email":true}'::jsonb, 'whatsapp', 'Rush celebration cakes, 2–3 tier within 4 hours.'),
  ('Askari Event Security', 'Joseph Barasa', '+254712000999', 'joseph@askarisecurity.co.ke', '{"security"}'::text[], -1.3476000000000001, 36.7559, 'Langata', 4.5, 145, 'ready', 40, 40, '{"whatsapp":false,"sms":true,"email":true}'::jsonb, 'sms', 'Licensed ushers, bouncers and access control.'),
  ('Rongai Power & Light', 'Samuel Kimani', '+254713000111', 'samuel@rongaipower.co.ke', '{"power","sound"}'::text[], -1.3948, 36.7477, 'Rongai', 4, 54, 'ready', 500, 65, '{"whatsapp":true,"sms":true,"email":true}'::jsonb, 'sms', 'Silent generators, event lighting, backup PA.')
) as t(name, lead, phone, email, categories, base_lat, base_lng, area, rating, jobs_done, readiness, capacity, response_mins, channels, preferred_channel, blurb)
where not exists (select 1 from public.providers);

insert into public.assessors (name, phone, area, rating, visits)
select name, phone, area, rating, visits from (values
  ('James Njoroge', '+254701000111', 'Karen', 4.9, 68),
  ('Lucy Atieno', '+254701000222', 'Kilimani', 4.8, 54),
  ('Daniel Mutua', '+254701000333', 'Kasarani', 4.7, 41)
) as t(name, phone, area, rating, visits)
where not exists (select 1 from public.assessors);
