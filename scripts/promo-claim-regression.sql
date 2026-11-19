BEGIN;
INSERT INTO public.promo_codes(code,trial_days,card_required,max_redemptions)
VALUES ('TEST_ONE',14,false,1);
DO $$
BEGIN
 IF NOT public.claim_promo_code('TEST_ONE','first') THEN RAISE EXCEPTION 'First claim failed'; END IF;
 IF public.claim_promo_code('TEST_ONE','second') THEN RAISE EXCEPTION 'Second claim exceeded cap'; END IF;
 IF NOT public.claim_promo_code('TEST_ONE','first') THEN RAISE EXCEPTION 'Same-user retry failed'; END IF;
 IF (SELECT count(*) FROM public.promo_redemptions WHERE code='TEST_ONE') <> 1 THEN RAISE EXCEPTION 'Retry duplicated row'; END IF;
 UPDATE public.promo_redemptions SET created_at=now()-interval '25 hours' WHERE code='TEST_ONE';
 IF NOT public.claim_promo_code('TEST_ONE','second') THEN RAISE EXCEPTION 'Aged pending claim blocked capacity'; END IF;
 UPDATE public.promo_redemptions SET status='expired' WHERE code='TEST_ONE' AND user_id='second';
 IF NOT public.claim_promo_code('TEST_ONE','third') THEN RAISE EXCEPTION 'Explicit expiry blocked capacity'; END IF;
 UPDATE public.promo_redemptions SET status='completed' WHERE code='TEST_ONE' AND user_id='third';
 IF public.claim_promo_code('TEST_ONE','third') THEN RAISE EXCEPTION 'Completed user redeemed twice'; END IF;
 IF public.claim_promo_code('TEST_ONE','fourth') THEN RAISE EXCEPTION 'Completed claim did not consume capacity'; END IF;
END;
$$;
ROLLBACK;
