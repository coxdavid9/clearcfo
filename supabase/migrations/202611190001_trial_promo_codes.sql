-- Example only; create codes explicitly after migration:
-- INSERT INTO public.promo_codes (code, trial_days, card_required, max_redemptions, label)
-- VALUES ('JEFF14', 14, false, 1, 'Jeff — Rustic Roots Pizza');
-- INSERT INTO public.promo_codes (code, trial_days, card_required, expires_at, label)
-- VALUES ('PARTNER30', 30, false, '2027-01-01', 'Partner code');
CREATE TABLE public.promo_codes (
 code text PRIMARY KEY CHECK (code ~ '^[A-Z0-9_-]{4,32}$'),
 trial_days int NOT NULL CHECK (trial_days BETWEEN 1 AND 90),
 card_required boolean NOT NULL DEFAULT true,
 max_redemptions int CHECK (max_redemptions IS NULL OR max_redemptions > 0),
 expires_at timestamptz,
 active boolean NOT NULL DEFAULT true,
 label text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.promo_redemptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 code text NOT NULL REFERENCES public.promo_codes(code),
 user_id text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (code, user_id)
);
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.promo_codes, public.promo_redemptions FROM anon, authenticated;
GRANT ALL ON public.promo_codes, public.promo_redemptions TO service_role;
ALTER TABLE public.subscriptions ADD COLUMN promo_code text, ADD COLUMN trial_card_required boolean;


-- A pending checkout consumes capacity until completion or expiry (at most 24h).
CREATE FUNCTION public.claim_promo_code(p_code text, p_user_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE promo public.promo_codes%ROWTYPE; own public.promo_redemptions%ROWTYPE; live_count bigint;
BEGIN
 SELECT * INTO promo FROM public.promo_codes WHERE code = p_code FOR UPDATE;
 IF NOT FOUND OR NOT promo.active OR (promo.expires_at IS NOT NULL AND promo.expires_at <= now()) THEN RETURN false; END IF;
 SELECT * INTO own FROM public.promo_redemptions WHERE code = p_code AND user_id = p_user_id;
 IF FOUND THEN
   IF own.status = 'completed' THEN RETURN false; END IF;
   IF own.status = 'pending' AND own.created_at > now() - interval '24 hours' THEN RETURN true; END IF;
 END IF;
 SELECT count(*) INTO live_count FROM public.promo_redemptions
 WHERE code = p_code AND (status = 'completed' OR (status = 'pending' AND created_at > now() - interval '24 hours'));
 IF promo.max_redemptions IS NOT NULL AND live_count >= promo.max_redemptions THEN RETURN false; END IF;
 INSERT INTO public.promo_redemptions(code,user_id,status) VALUES(p_code,p_user_id,'pending')
 ON CONFLICT(code,user_id) DO UPDATE SET status='pending', created_at=now();
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_promo_code(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_promo_code(text,text) TO service_role;
