
CREATE TABLE public.concierge_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  topic TEXT NOT NULL,
  label TEXT NOT NULL,
  body TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.concierge_knowledge TO service_role;

ALTER TABLE public.concierge_knowledge ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies: all access goes through server functions
-- gated by the admin passkey using the service role client.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_concierge_knowledge_updated_at
BEFORE UPDATE ON public.concierge_knowledge
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX concierge_knowledge_enabled_sort_idx
  ON public.concierge_knowledge (enabled, sort_order);
