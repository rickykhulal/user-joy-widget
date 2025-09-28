-- Only create tables that don't exist yet
-- Check if notes table exists, if not create it
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(content) <= 200),
  source_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on notes if not already enabled
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Create policies for notes (will not error if they exist)
DO $$
BEGIN
  -- Notes policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notes' AND policyname = 'Notes are viewable by everyone') THEN
    CREATE POLICY "Notes are viewable by everyone" ON public.notes FOR SELECT USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notes' AND policyname = 'Users can create their own notes') THEN
    CREATE POLICY "Users can create their own notes" ON public.notes FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notes' AND policyname = 'Users can update their own notes') THEN
    CREATE POLICY "Users can update their own notes" ON public.notes FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notes' AND policyname = 'Users can delete their own notes') THEN
    CREATE POLICY "Users can delete their own notes" ON public.notes FOR DELETE USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Create note votes table if not exists
CREATE TABLE IF NOT EXISTS public.note_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(note_id, user_id)
);

-- Enable RLS on note_votes
ALTER TABLE public.note_votes ENABLE ROW LEVEL SECURITY;

-- Create note_votes policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'note_votes' AND policyname = 'Note votes are viewable by everyone') THEN
    CREATE POLICY "Note votes are viewable by everyone" ON public.note_votes FOR SELECT USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'note_votes' AND policyname = 'Users can create their own note votes') THEN
    CREATE POLICY "Users can create their own note votes" ON public.note_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'note_votes' AND policyname = 'Users can update their own note votes') THEN
    CREATE POLICY "Users can update their own note votes" ON public.note_votes FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'note_votes' AND policyname = 'Users can delete their own note votes') THEN
    CREATE POLICY "Users can delete their own note votes" ON public.note_votes FOR DELETE USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Add credibility fields to existing profiles table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'credibility_score') THEN
    ALTER TABLE public.profiles ADD COLUMN credibility_score INTEGER DEFAULT 100;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'credibility_badge') THEN
    ALTER TABLE public.profiles ADD COLUMN credibility_badge TEXT DEFAULT 'new_user';
  END IF;
END
$$;

-- Create triggers for automatic timestamp updates if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_notes_updated_at') THEN
    CREATE TRIGGER update_notes_updated_at
    BEFORE UPDATE ON public.notes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$$;

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