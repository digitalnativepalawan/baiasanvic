
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read site-assets'
  ) THEN
    CREATE POLICY "Public read site-assets"
      ON storage.objects
      FOR SELECT
      TO anon, authenticated
      USING (bucket_id = 'site-assets');
  END IF;
END$$;
