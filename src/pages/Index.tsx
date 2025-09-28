import { useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import { PostForm } from "@/components/PostForm";
import { PostCard } from "@/components/PostCard";
import Auth from "./Auth";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch user profile
          setTimeout(async () => {
            try {
              const { data: profileData, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("user_id", session.user.id)
                .single();

              if (error && error.code !== 'PGRST116') {
                console.error("Error fetching profile:", error);
              } else {
                setProfile(profileData);
              }
            } catch (error) {
              console.error("Error fetching profile:", error);
            }
          }, 0);
        } else {
          setProfile(null);
        }
        setIsLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchPosts();
    }
  }, [user]);

  const fetchPosts = async () => {
    try {
      const { data: postsData, error } = await supabase
        .from("posts")
        .select(`
          *,
          profiles (
            username
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPosts(postsData || []);
    } catch (error) {
      console.error("Error fetching posts:", error);
      toast({
        title: "Error",
        description: "Failed to load posts",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} profile={profile} />
      
      <main className="mx-auto max-w-4xl px-4 py-6">
        <PostForm 
          user={user} 
          profile={profile} 
          onPostCreated={fetchPosts} 
        />
        
        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No posts yet. Be the first to share something for fact-checking!
              </p>
            </div>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUser={user}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
