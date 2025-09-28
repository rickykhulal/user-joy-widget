-- Fix security warnings by setting proper search paths for functions

-- Fix calculate_user_badge function
CREATE OR REPLACE FUNCTION public.calculate_user_badge(score INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF score >= 500 THEN
    RETURN 'trusted_contributor';
  ELSIF score <= 50 THEN
    RETURN 'low_credibility';
  ELSE
    RETURN 'regular_user';
  END IF;
END;
$$;

-- Fix update_user_credibility function
CREATE OR REPLACE FUNCTION public.update_user_credibility(user_id_param UUID, delta_score INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_score INTEGER;
  new_badge TEXT;
BEGIN
  -- Update credibility in profiles table
  UPDATE public.profiles
  SET credibility_score = COALESCE(credibility_score, 100) + delta_score,
      updated_at = now()
  WHERE user_id = user_id_param;
  
  -- Get the new score
  SELECT credibility_score INTO new_score
  FROM public.profiles
  WHERE user_id = user_id_param;
  
  -- Calculate and update badge
  new_badge := public.calculate_user_badge(COALESCE(new_score, 100));
  
  UPDATE public.profiles
  SET credibility_badge = new_badge
  WHERE user_id = user_id_param;
END;
$$;