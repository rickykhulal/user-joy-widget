-- Create storage bucket for uploaded images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('post-images', 'post-images', true);

-- Create RLS policies for the post-images bucket
CREATE POLICY "Anyone can view post images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'post-images');

CREATE POLICY "Authenticated users can upload post images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'post-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own post images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own post images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);