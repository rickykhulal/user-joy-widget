import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, Image, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { uploadImage } from "@/utils/imageUpload";

interface PostFormProps {
  user: any;
  profile: any;
  onPostCreated: () => void;
}

export const PostForm = ({ user, profile, onPostCreated }: PostFormProps) => {
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<'url' | 'file'>('file');
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Error",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "Image must be smaller than 5MB",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setImageUrl("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      toast({
        title: "Error",
        description: "Please enter content to fact-check",
        variant: "destructive",
      });
      return;
    }

    setIsPosting(true);

    try {
      let finalImageUrl = null;

      // Handle image upload if file is selected
      if (selectedFile) {
        finalImageUrl = await uploadImage(selectedFile, user.id);
        if (!finalImageUrl) {
          throw new Error('Failed to upload image');
        }
      } else if (uploadMethod === 'url' && imageUrl.trim()) {
        finalImageUrl = imageUrl.trim();
      }

      const { error } = await supabase
        .from("posts")
        .insert({
          user_id: user.id,
          content: content.trim(),
          image_url: finalImageUrl,
        });

      if (error) throw error;

      setContent("");
      setImageUrl("");
      clearImage();
      onPostCreated();
      
      toast({
        title: "Success",
        description: "Your post has been submitted for fact-checking!",
      });
    } catch (error) {
      console.error("Error creating post:", error);
      toast({
        title: "Error",
        description: "Failed to create post",
        variant: "destructive",
      });
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="post-card">
      <div className="flex items-start space-x-3 mb-4">
        <div className="username-avatar">
          {profile?.username ? profile.username.charAt(0).toUpperCase() : 'U'}
        </div>
        <div className="flex-1">
          <p className="font-semibold">{profile?.username || 'User'}</p>
          <p className="text-sm text-muted-foreground">Share something to verify...</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Textarea
            placeholder="What would you like the community to fact-check?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={500}
            className="min-h-[100px] resize-none"
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm text-muted-foreground">
              {content.length}/500 characters
            </span>
          </div>
        </div>

        {/* Image upload section */}
        <div className="space-y-3">
          <div className="flex items-center space-x-4">
            <Label className="flex items-center space-x-2">
              <Image className="h-4 w-4" />
              <span>Add Image</span>
            </Label>
            <div className="flex items-center space-x-2 text-sm">
              <button
                type="button"
                onClick={() => setUploadMethod('file')}
                className={`px-2 py-1 rounded transition-colors ${
                  uploadMethod === 'file' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Upload
              </button>
              <button
                type="button"
                onClick={() => setUploadMethod('url')}
                className={`px-2 py-1 rounded transition-colors ${
                  uploadMethod === 'url' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                URL
              </button>
            </div>
          </div>

          {uploadMethod === 'file' ? (
            <div>
              <div className="flex items-center space-x-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-sm file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
                {(selectedFile || previewUrl) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {previewUrl && (
                <div className="mt-2">
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="max-w-full h-32 object-cover rounded border"
                  />
                </div>
              )}
            </div>
          ) : (
            <Input
              placeholder="https://example.com/image.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          )}
        </div>

        <div className="flex justify-end">
          <Button 
            type="submit" 
            disabled={isPosting || !content.trim()}
            className="flex items-center space-x-2"
          >
            <Send className="h-4 w-4" />
            <span>{isPosting ? "Posting..." : "Post"}</span>
          </Button>
        </div>
      </form>
    </div>
  );
};