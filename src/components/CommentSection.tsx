import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send, Trash2, Clock, Image, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { uploadImage } from "@/utils/imageUpload";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Comment {
  id: string;
  content: string;
  image_url?: string;
  created_at: string;
  user_id: string;
  profiles: {
    username: string;
  };
}

interface CommentSectionProps {
  postId: string;
  currentUser: any;
}

export const CommentSection = ({ postId, currentUser }: CommentSectionProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (showComments) {
      fetchComments();
    }
  }, [postId, showComments]);

  const fetchComments = async () => {
    try {
      // Fetch comments
      const { data: commentsData, error: commentsError } = await supabase
        .from("comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (commentsError) throw commentsError;

      if (!commentsData || commentsData.length === 0) {
        setComments([]);
        return;
      }

      // Get unique user IDs from comments
      const userIds = [...new Set(commentsData.map(comment => comment.user_id))];

      // Fetch profiles for comment authors
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, username")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      // Create a map of user_id to profile
      const profilesMap = new Map();
      profilesData?.forEach(profile => {
        profilesMap.set(profile.user_id, profile);
      });

      // Combine comments with profiles
      const commentsWithProfiles = commentsData.map(comment => ({
        ...comment,
        profiles: profilesMap.get(comment.user_id) || { username: 'Unknown User' }
      }));

      setComments(commentsWithProfiles);
    } catch (error) {
      console.error("Error fetching comments:", error);
      toast({
        title: "Error",
        description: "Failed to load comments",
        variant: "destructive",
      });
    }
  };

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
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      toast({
        title: "Authentication required",
        description: "Please log in to comment",
        variant: "destructive",
      });
      return;
    }

    if (!newComment.trim() && !selectedFile) {
      toast({
        title: "Error",
        description: "Please enter a comment or select an image",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let imageUrl = null;

      // Upload image if selected
      if (selectedFile) {
        imageUrl = await uploadImage(selectedFile, currentUser.id);
        if (!imageUrl) {
          throw new Error('Failed to upload image');
        }
      }

      const { error } = await supabase
        .from("comments")
        .insert({
          post_id: postId,
          user_id: currentUser.id,
          content: newComment.trim(),
          image_url: imageUrl,
        });

      if (error) throw error;

      setNewComment("");
      clearImage();
      await fetchComments();
      
      toast({
        title: "Success",
        description: "Comment added successfully!",
      });
    } catch (error) {
      console.error("Error adding comment:", error);
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;

      await fetchComments();
      
      toast({
        title: "Success",
        description: "Comment deleted successfully!",
      });
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast({
        title: "Error",
        description: "Failed to delete comment",
        variant: "destructive",
      });
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <div className="mt-4 border-t pt-4">
      <Button
        variant="ghost"
        onClick={() => setShowComments(!showComments)}
        className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <MessageSquare className="h-4 w-4" />
        <span>{comments.length} Comments</span>
      </Button>

      {showComments && (
        <div className="mt-4 space-y-4">
          {/* Comment form */}
          {currentUser && (
            <form onSubmit={handleSubmitComment} className="space-y-3">
              <Textarea
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                maxLength={1000}
                className="min-h-[80px] resize-none"
              />
              
              {/* Image upload for comments */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="w-auto text-sm file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-muted file:text-muted-foreground hover:file:bg-muted/80"
                  />
                  {(selectedFile || previewUrl) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearImage}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              {previewUrl && (
                <div className="mt-2">
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="max-w-full h-20 object-cover rounded border"
                  />
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {newComment.length}/1000 characters
                </span>
                <Button 
                  type="submit" 
                  size="sm"
                  disabled={isSubmitting || (!newComment.trim() && !selectedFile)}
                  className="flex items-center space-x-2"
                >
                  <Send className="h-3 w-3" />
                  <span>{isSubmitting ? "Posting..." : "Comment"}</span>
                </Button>
              </div>
            </form>
          )}

          {/* Comments list */}
          <div className="space-y-3">
            {comments.length === 0 ? (
              <p className="text-muted-foreground text-sm">No comments yet. Be the first to comment!</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="comment-card">
                  <div className="flex items-start space-x-3">
                    <div className="username-avatar text-xs">
                      {comment.profiles.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-sm">{comment.profiles.username}</span>
                          <span className="flex items-center text-xs text-muted-foreground">
                            <Clock className="h-3 w-3 mr-1" />
                            {formatTimeAgo(comment.created_at)}
                          </span>
                        </div>
                        {currentUser?.id === comment.user_id && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-destructive/10">
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Comment</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this comment? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteComment(comment.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                      
                      {comment.content && (
                        <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
                      )}
                      
                      {comment.image_url && (
                        <div className="mt-2">
                          <img 
                            src={comment.image_url} 
                            alt="Comment attachment" 
                            className="max-w-full rounded border cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(comment.image_url, '_blank')}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};