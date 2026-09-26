import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  signUp: (email: string, pass: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, pass: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  // Fallback demo login mode when Supabase env keys are not populated yet
  demoLogin: (email: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) {
      // Check demo user in localStorage
      const demoEmail = localStorage.getItem('tcf_demo_user');
      if (demoEmail) {
        setUser({ id: 'demo_user_id', email: demoEmail } as User);
      }
      setLoading(false);
      return;
    }

    // Initialize Supabase Auth session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, pass: string) => {
    if (!supabase || !isSupabaseConfigured) {
      demoLogin(email);
      return { error: null };
    }
    const { error } = await supabase.auth.signUp({
      email,
      password: pass
    });
    return { error: error ? new Error(error.message) : null };
  };

  const signIn = async (email: string, pass: string) => {
    if (!supabase || !isSupabaseConfigured) {
      demoLogin(email);
      return { error: null };
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass
    });
    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => {
    if (supabase && isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('tcf_demo_user');
    setUser(null);
    setSession(null);
  };

  const demoLogin = (email: string) => {
    localStorage.setItem('tcf_demo_user', email);
    setUser({ id: 'demo_user_id', email } as User);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isConfigured: isSupabaseConfigured,
        signUp,
        signIn,
        signOut,
        demoLogin
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
