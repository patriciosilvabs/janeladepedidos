import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'owner' | 'admin' | 'user';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  isOwner: boolean;
  isAdmin: boolean;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Use refs to avoid multiple initializations and track state
  const initializedRef = useRef(false);
  const mountedRef = useRef(true);
  const lastEventTimeRef = useRef<number>(0);
  const previousUserRef = useRef<User | null>(null);

  const fetchUserRole = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();
      
      if (data && !error && mountedRef.current) {
        setRole(data.role as AppRole);
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
    }
  }, []);

  useEffect(() => {
    // Prevent double initialization (React StrictMode or fast remounts)
    if (initializedRef.current) return;
    initializedRef.current = true;
    mountedRef.current = true;

    // ONLY use onAuthStateChange - do NOT call getSession() separately
    // This prevents duplicate refresh token calls that cause race conditions
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!mountedRef.current) return;
        
        // Debounce TOKEN_REFRESHED events to prevent rate limiting
        const now = Date.now();
        if (event === 'TOKEN_REFRESHED' && now - lastEventTimeRef.current < 2000) {
          return;
        }
        lastEventTimeRef.current = now;
        
        // During token refresh, ignore null sessions temporarily
        // This prevents the flash of redirecting to /auth during refresh
        if (event === 'TOKEN_REFRESHED' && !currentSession && previousUserRef.current) {
          // Token refresh returned null but we had a user - likely transient state
          // Don't update state, wait for the next event
          return;
        }
        
        // Track previous user for comparison
        previousUserRef.current = currentSession?.user ?? null;
        
        // Update state
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        // Only set loading to false on definitive events
        // This prevents premature redirect during token refresh
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          setLoading(false);
        } else if (event === 'TOKEN_REFRESHED' && currentSession) {
          // Token refreshed successfully with valid session
          setLoading(false);
        }
        
        if (currentSession?.user) {
          // Defer role fetch to avoid Supabase deadlock
          setTimeout(() => {
            if (mountedRef.current) {
              fetchUserRole(currentSession.user.id);
            }
          }, 0);
        } else {
          setRole(null);
        }
      }
    );

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array - only run once

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const value: AuthContextType = {
    user,
    session,
    role,
    isOwner: role === 'owner',
    isAdmin: role === 'admin' || role === 'owner',
    loading,
    signUp,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
