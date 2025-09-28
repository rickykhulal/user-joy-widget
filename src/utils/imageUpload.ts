import { supabase } from "@/integrations/supabase/client";

export const uploadImage = async (file: File, userId: string): Promise<string | null> => {
  try {
    // Create a unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    // Upload the file
    const { data, error } = await supabase.storage
      .from('post-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('post-images')
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading image:', error);
    return null;
  }
};

export const deleteImage = async (imagePath: string): Promise<boolean> => {
  try {
    // Extract the path from the full URL
    const urlParts = imagePath.split('/');
    const bucketPath = urlParts.slice(-2).join('/'); // Get userId/filename.ext

    const { error } = await supabase.storage
      .from('post-images')
      .remove([bucketPath]);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting image:', error);
    return false;
  }
};