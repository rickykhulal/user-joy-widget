-- Create user credibility table
CREATE TABLE public.user_credibility (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 100,
  badge TEXT DEFAULT 'new_user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_credibility
ALTER TABLE public.user_credibility ENABLE ROW LEVEL SECURITY;

-- Create policies for user_credibility
CREATE POLICY "Credibility scores are viewable by everyone" 
ON public.user_credibility 
FOR SELECT 
USING (true);

CREATE POLICY "Users can update their own credibility" 
ON public.user_credibility 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert credibility records" 
ON public.user_credibility 
FOR INSERT 
WITH CHECK (true);

-- Create notes table
CREATE TABLE public.notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(content) <= 200),
  source_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on notes
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Create policies for notes
CREATE POLICY "Notes are viewable by everyone" 
ON public.notes 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own notes" 
ON public.notes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes" 
ON public.notes 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes" 
ON public.notes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create note votes table
CREATE TABLE public.note_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(note_id, user_id)
);

-- Enable RLS on note_votes
ALTER TABLE public.note_votes ENABLE ROW LEVEL SECURITY;

-- Create policies for note_votes
CREATE POLICY "Note votes are viewable by everyone" 
ON public.note_votes 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own note votes" 
ON public.note_votes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own note votes" 
ON public.note_votes 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own note votes" 
ON public.note_votes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_user_credibility_updated_at
BEFORE UPDATE ON public.user_credibility
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notes_updated_at
BEFORE UPDATE ON public.notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to calculate user credibility badge based on score
CREATE OR REPLACE FUNCTION public.calculate_user_badge(score INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
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

-- Function to update user credibility
CREATE OR REPLACE FUNCTION public.update_user_credibility(user_id_param UUID, delta_score INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_score INTEGER;
  new_badge TEXT;
BEGIN
  -- Insert or update credibility record
  INSERT INTO public.user_credibility (user_id, score)
  VALUES (user_id_param, 100 + delta_score)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    score = user_credibility.score + delta_score,
    updated_at = now();
  
  -- Get the new score
  SELECT score INTO new_score
  FROM public.user_credibility
  WHERE user_id = user_id_param;
  
  -- Calculate and update badge
  new_badge := public.calculate_user_badge(new_score);
  
  UPDATE public.user_credibility
  SET badge = new_badge
  WHERE user_id = user_id_param;
END;
$$;

-- Function to get community verdict for a post
CREATE OR REPLACE FUNCTION public.get_community_verdict(post_id_param UUID)
RETURNS TABLE (
  verdict TEXT,
  total_notes INTEGER,
  avg_score NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  fake_notes INTEGER := 0;
  real_notes INTEGER := 0;
  mixed_notes INTEGER := 0;
  total INTEGER := 0;
BEGIN
  -- Count notes by their vote scores and content analysis
  SELECT COUNT(*) INTO total
  FROM public.notes n
  WHERE n.post_id = post_id_param;
  
  IF total = 0 THEN
    RETURN QUERY SELECT 'no_verdict'::TEXT, 0, 0::NUMERIC;
    RETURN;
  END IF;
  
  -- Simple heuristic: if majority of top-voted notes suggest fake/real
  WITH note_scores AS (
    SELECT 
      n.*,
      COALESCE(SUM(CASE WHEN nv.vote_type = 'up' THEN 1 WHEN nv.vote_type = 'down' THEN -1 ELSE 0 END), 0) as score
    FROM public.notes n
    LEFT JOIN public.note_votes nv ON n.id = nv.note_id
    WHERE n.post_id = post_id_param
    GROUP BY n.id, n.post_id, n.user_id, n.content, n.source_url, n.created_at, n.updated_at
  ),
  top_notes AS (
    SELECT * FROM note_scores 
    WHERE score >= 0
    ORDER BY score DESC
    LIMIT GREATEST(1, total / 2)
  )
  SELECT 
    CASE 
      WHEN COUNT(*) = 0 THEN 'mixed'
      WHEN AVG(score) >= 2 THEN 'likely_real'
      WHEN AVG(score) <= -1 THEN 'likely_fake'
      ELSE 'mixed'
    END,
    COUNT(*)::INTEGER,
    COALESCE(AVG(score), 0)
  INTO verdict, total_notes, avg_score
  FROM top_notes;
  
  RETURN QUERY SELECT verdict, total_notes, avg_score;
END;
$$;