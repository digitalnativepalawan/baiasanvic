DROP POLICY IF EXISTS "Public read site-assets" ON storage.objects;
CREATE POLICY "Public read site-assets" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'site-assets');