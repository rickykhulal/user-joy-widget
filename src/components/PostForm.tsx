import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, Image } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PostFormProps {
  user: any;
  profile: any;
  onPostCreated: () => void;
}

export const PostForm = ({ user, profile, onPostCreated }: PostFormProps) => {
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const { toast } = useToast();

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
      const { error } = await supabase
        .from("posts")
        .insert({
          user_id: user.id,
          content: content.trim(),
          image_url: imageUrl.trim() || null,
        });

      if (error) throw error;

      setContent("");
      setImageUrl("");
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

        <div className="space-y-2">
          <Label htmlFor="image-url" className="flex items-center space-x-2">
            <Image className="h-4 w-4" />
            <span>Image URL (optional)</span>
          </Label>
          <Input
            id="image-url"
            placeholder="https://example.com/image.jpg"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
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