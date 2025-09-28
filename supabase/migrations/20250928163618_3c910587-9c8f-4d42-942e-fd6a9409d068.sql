-- Add foreign key reference from posts to profiles via user_id
-- First, we need to ensure all existing posts have valid user_ids that exist in profiles
-- Since we're using user_id from auth.users, we need to handle this properly

-- Update the posts table to have proper foreign key to auth.users
-- (We can't directly reference profiles because not all users might have profiles yet)
-- The relationship will be handled through user_id matching

-- Add an index for better performance on user_id lookups
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);