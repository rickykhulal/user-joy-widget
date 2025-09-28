import { useState, useEffect } from "react";
import { ChevronUp, ChevronDown, Plus, ExternalLink, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CredibilityBadge } from "./CredibilityBadge";

interface Note {
  id: string;
  content: string;
  source_url?: string;
  created_at: string;
  user_id: string;
  profiles: {
    username: string;
    credibility_score?: number;
    credibility_badge?: string;
  };
  vote_score: number;
  user_vote?: 'up' | 'down' | null;
}

interface CommunityNotesProps {
  postId: string;
  currentUser: any;
  onNotesChange?: (notesCount: number) => void;
}

export const CommunityNotes = ({ postId, currentUser, onNotesChange }: CommunityNotesProps) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchNotes();
  }, [postId]);

  const fetchNotes = async () => {
    try {
      // First, fetch notes
      const { data: notesData, error } = await supabase
        .from("notes")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get vote scores and profiles for each note
      const notesWithScoresAndProfiles = await Promise.all(
        (notesData || []).map(async (note) => {
          // Fetch profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("username, credibility_score, credibility_badge")
            .eq("user_id", note.user_id)
            .single();

          // Fetch votes
          const { data: votes } = await supabase
            .from("note_votes")
            .select("vote_type, user_id")
            .eq("note_id", note.id);

          const upVotes = votes?.filter(v => v.vote_type === 'up').length || 0;
          const downVotes = votes?.filter(v => v.vote_type === 'down').length || 0;
          const vote_score = upVotes - downVotes;
          
          const user_vote = votes?.find(v => v.user_id === currentUser?.id)?.vote_type as "up" | "down" | null || null;

          return {
            ...note,
            profiles: profile || { username: "Unknown", credibility_score: 100, credibility_badge: "regular_user" },
            vote_score,
            user_vote
          };
        })
      );

      // Sort by vote score (highest first)
      notesWithScoresAndProfiles.sort((a, b) => b.vote_score - a.vote_score);
      setNotes(notesWithScoresAndProfiles);
      onNotesChange?.(notesWithScoresAndProfiles.length);
    } catch (error) {
      console.error("Error fetching notes:", error);
    }
  };

  const handleAddNote = async () => {
    if (!currentUser) {
      toast({
        title: "Authentication required",
        description: "Please log in to add notes",
        variant: "destructive",
      });
      return;
    }

    if (!noteContent.trim()) {
      toast({
        title: "Content required",
        description: "Please add content to your note",
        variant: "destructive",
      });
      return;
    }

    if (noteContent.length > 200) {
      toast({
        title: "Content too long",
        description: "Notes must be 200 characters or less",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("notes")
        .insert({
          post_id: postId,
          user_id: currentUser.id,
          content: noteContent.trim(),
          source_url: sourceUrl.trim() || null,
        });

      if (error) throw error;

      // Award credibility points for adding a note
      await supabase.rpc('update_user_credibility', {
        user_id_param: currentUser.id,
        delta_score: 5
      });

      toast({
        title: "Note added successfully!",
        description: "Thank you for contributing to the community.",
      });

      setNoteContent("");
      setSourceUrl("");
      setShowAddNote(false);
      fetchNotes();
    } catch (error) {
      console.error("Error adding note:", error);
      toast({
        title: "Error",
        description: "Failed to add note",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoteNote = async (noteId: string, voteType: 'up' | 'down') => {
    if (!currentUser) {
      toast({
        title: "Authentication required",
        description: "Please log in to vote on notes",
        variant: "destructive",
      });
      return;
    }

    try {
      const existingVote = notes.find(n => n.id === noteId)?.user_vote;
      
      if (existingVote === voteType) {
        // Remove vote if clicking the same option
        await supabase
          .from("note_votes")
          .delete()
          .eq("note_id", noteId)
          .eq("user_id", currentUser.id);
      } else {
        // Insert or update vote
        await supabase
          .from("note_votes")
          .upsert({
            note_id: noteId,
            user_id: currentUser.id,
            vote_type: voteType,
          });

        // Award/deduct credibility points for note author
        const note = notes.find(n => n.id === noteId);
        if (note) {
          const deltaScore = voteType === 'up' ? 10 : -5;
          await supabase.rpc('update_user_credibility', {
            user_id_param: note.user_id,
            delta_score: deltaScore
          });
        }
      }

      fetchNotes();
    } catch (error) {
      console.error("Error voting on note:", error);
      toast({
        title: "Error",
        description: "Failed to vote on note",
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
    <div className="mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">Community Notes</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddNote(!showAddNote)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Note
        </Button>
      </div>

      {showAddNote && (
        <Card className="mb-4">
          <CardHeader>
            <h4 className="font-medium">Add Community Note</h4>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Provide context, fact-check, or additional information... (max 200 characters)"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              maxLength={200}
            />
            <div className="text-sm text-muted-foreground text-right">
              {noteContent.length}/200 characters
            </div>
            <Input
              type="url"
              placeholder="Source link (optional but recommended)"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddNote(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddNote} disabled={isSubmitting}>
                {isSubmitting ? "Adding..." : "Add Note"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {notes.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            No community notes yet. Be the first to add context!
          </p>
        ) : (
          notes.map((note) => (
            <Card key={note.id} className="note-card">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="username-avatar text-xs">
                      {note.profiles.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-sm">{note.profiles.username}</span>
                    <CredibilityBadge 
                      badge={note.profiles.credibility_badge || 'regular_user'}
                      score={note.profiles.credibility_score || 100}
                    />
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(note.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleVoteNote(note.id, 'up')}
                      className={`p-1 rounded transition-colors ${
                        note.user_vote === 'up' 
                          ? 'bg-success text-success-foreground' 
                          : 'hover:bg-muted'
                      }`}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-medium min-w-[2ch] text-center">
                      {note.vote_score}
                    </span>
                    <button
                      onClick={() => handleVoteNote(note.id, 'down')}
                      className={`p-1 rounded transition-colors ${
                        note.user_vote === 'down' 
                          ? 'bg-destructive text-destructive-foreground' 
                          : 'hover:bg-muted'
                      }`}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                <p className="text-sm mb-3">{note.content}</p>
                
                <div className="flex items-center justify-between">
                  {note.source_url ? (
                    <a
                      href={note.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Source
                    </a>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-warning">
                      <AlertTriangle className="h-3 w-3" />
                      Unverified
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};