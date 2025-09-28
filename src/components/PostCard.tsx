import { useState, useEffect } from "react";
import { Check, X, Clock, Trash2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CommentSection } from "./CommentSection";
import { CommunityNotes } from "./CommunityNotes";
import { CommunityVerdict } from "./CommunityVerdict";
import { CredibilityBadge } from "./CredibilityBadge";
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
import { Button } from "@/components/ui/button";

interface PostCardProps {
  post: {
    id: string;
    content: string;
    image_url?: string;
    created_at: string;
    user_id: string;
    profiles: {
      username: string;
      credibility_score?: number;
      credibility_badge?: string;
    };
  };
  currentUser: any;
  onPostDeleted: () => void;
}

export const PostCard = ({ post, currentUser, onPostDeleted }: PostCardProps) => {
  const [votes, setVotes] = useState<any[]>([]);
  const [userVote, setUserVote] = useState(null);
  const [isVoting, setIsVoting] = useState(false);
  const [notesCount, setNotesCount] = useState(0);
  const [communityVerdict, setCommunityVerdict] = useState<'likely_real' | 'likely_fake' | 'mixed' | 'no_verdict'>('no_verdict');
  const { toast } = useToast();

  useEffect(() => {
    fetchVotes();
  }, [post.id]);

  const fetchVotes = async () => {
    try {
      const { data: votesData, error } = await supabase
        .from("votes")
        .select("*")
        .eq("post_id", post.id);

      if (error) throw error;

      setVotes(votesData || []);
      
      // Find current user's vote
      const currentUserVote = votesData?.find(vote => vote.user_id === currentUser?.id);
      setUserVote(currentUserVote?.vote_type || null);
    } catch (error) {
      console.error("Error fetching votes:", error);
    }
  };

  const handleVote = async (voteType: 'true' | 'false') => {
    if (!currentUser) {
      toast({
        title: "Authentication required",
        description: "Please log in to vote",
        variant: "destructive",
      });
      return;
    }

    setIsVoting(true);

    try {
      // Check if user already voted
      const existingVote = votes.find(vote => vote.user_id === currentUser.id);
      
      if (existingVote) {
        if (existingVote.vote_type === voteType) {
          // Remove vote if clicking the same option
          const { error } = await supabase
            .from("votes")
            .delete()
            .eq("id", existingVote.id);
          
          if (error) throw error;
          setUserVote(null);
        } else {
          // Update vote if clicking different option
          const { error } = await supabase
            .from("votes")
            .update({ vote_type: voteType })
            .eq("id", existingVote.id);
          
          if (error) throw error;
          setUserVote(voteType);
        }
      } else {
        // Create new vote
        const { error } = await supabase
          .from("votes")
          .insert({
            post_id: post.id,
            user_id: currentUser.id,
            vote_type: voteType,
          });
        
        if (error) throw error;
        setUserVote(voteType);
      }

      // Refresh votes
      await fetchVotes();
    } catch (error) {
      console.error("Error voting:", error);
      toast({
        title: "Error",
        description: "Failed to submit vote",
        variant: "destructive",
      });
    } finally {
      setIsVoting(false);
    }
  };

  const handleDeletePost = async () => {
    try {
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", post.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Post deleted successfully!",
      });

      onPostDeleted();
    } catch (error) {
      console.error("Error deleting post:", error);
      toast({
        title: "Error",
        description: "Failed to delete post",
        variant: "destructive",
      });
    }
  };

  const trueVotes = votes.filter(vote => vote.vote_type === 'true').length;
  const falseVotes = votes.filter(vote => vote.vote_type === 'false').length;
  const totalVotes = trueVotes + falseVotes;
  
  const truePercentage = totalVotes > 0 ? Math.round((trueVotes / totalVotes) * 100) : 0;
  const falsePercentage = totalVotes > 0 ? Math.round((falseVotes / totalVotes) * 100) : 0;

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
    <div className="post-card">
      <div className="flex items-start space-x-3 mb-3">
        <div className="username-avatar">
          {post.profiles.username.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="font-semibold">{post.profiles.username}</span>
              <CredibilityBadge 
                badge={post.profiles.credibility_badge || 'regular_user'}
                score={post.profiles.credibility_score || 100}
              />
              {/* Vote indicators */}
              {totalVotes > 0 && (
                <>
                  {truePercentage > 55 && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-success text-success-foreground">
                      true
                    </span>
                  )}
                  {truePercentage < 45 && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-destructive text-destructive-foreground">
                      fake
                    </span>
                  )}
                  {truePercentage >= 45 && truePercentage <= 55 && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-warning text-warning-foreground">
                      ambiguous
                    </span>
                  )}
                </>
              )}
              <span className="flex items-center text-sm text-muted-foreground">
                <Clock className="h-3 w-3 mr-1" />
                {formatTimeAgo(post.created_at)}
              </span>
            </div>
            
            {/* Delete button for post owner */}
            {currentUser?.id === post.user_id && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Post</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this post? This action cannot be undone and will also delete all comments and votes.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeletePost}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Post
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-foreground whitespace-pre-wrap">{post.content}</p>
        {post.image_url && (
          <div className="mt-3">
            <img 
              src={post.image_url} 
              alt="Post attachment" 
              className="max-w-full rounded-lg border"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>
        )}
      </div>

      {/* Vote percentages bar */}
      {totalVotes > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>True: {truePercentage}%</span>
            <span>Fake: {falsePercentage}%</span>
          </div>
          <div className="percentage-bar">
            <div className="flex h-full">
              <div 
                className="percentage-fill-true" 
                style={{ width: `${truePercentage}%` }}
              />
              <div 
                className="percentage-fill-false" 
                style={{ width: `${falsePercentage}%` }}
              />
            </div>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {totalVotes} total vote{totalVotes !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleVote('true')}
            disabled={isVoting}
            className={`vote-button-true ${
              userVote === 'true' ? 'ring-2 ring-accent ring-offset-2' : ''
            }`}
          >
            <Check className="h-4 w-4 mr-1" />
            True ({trueVotes})
          </button>
          
          <button
            onClick={() => handleVote('false')}
            disabled={isVoting}
            className={`vote-button-false ${
              userVote === 'false' ? 'ring-2 ring-destructive ring-offset-2' : ''
            }`}
          >
            <X className="h-4 w-4 mr-1" />
            Fake ({falseVotes})
          </button>

          <Button 
            variant="outline" 
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              toast({
                title: "AI Insight",
                description: "AI analysis feature coming soon!",
              });
            }}
          >
            <Sparkles className="h-3 w-3 mr-1" />
            AI Insight
          </Button>
        </div>

        {userVote && (
          <span className="text-sm text-muted-foreground">
            You voted: {userVote === 'true' ? 'True' : 'Fake'}
          </span>
        )}
      </div>

      {/* Community Verdict */}
      <CommunityVerdict
        postId={post.id}
        notesCount={notesCount}
        verdict={communityVerdict}
      />

      {/* Community Notes Section */}
      <CommunityNotes
        postId={post.id}
        currentUser={currentUser}
        onNotesChange={(count) => {
          setNotesCount(count);
          // Simple verdict calculation based on notes count
          if (count === 0) {
            setCommunityVerdict('no_verdict');
          } else if (count >= 3) {
            setCommunityVerdict('mixed'); // Will be enhanced with AI analysis
          } else {
            setCommunityVerdict('mixed');
          }
        }}
      />

      {/* Comments section */}
      <CommentSection postId={post.id} currentUser={currentUser} />
    </div>
  );
};