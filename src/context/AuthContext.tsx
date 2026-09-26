import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  isEmailVerified: boolean;
  signUp: (email: string, pass: string) => Promise<{ error: Error | null; needsVerification?: boolean }>;
  signIn: (email: string, pass: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resendVerification: (email: string) => Promise<{ error: Error | null }>;
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
        setUser({
          id: 'demo_user_id',
          email: demoEmail,
          email_confirmed_at: new Date().toISOString()
        } as unknown as User);
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
      return { error: null, needsVerification: false };
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass
    });
    if (error) {
      return { error: new Error(error.message), needsVerification: false };
    }
    
    // In Supabase, if email confirmation is required, session will be null or email_confirmed_at will be null
    const needsVerification = Boolean(data.user && (!data.session || !data.user.email_confirmed_at));
    return { error: null, needsVerification };
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

  const resendVerification = async (email: string) => {
    if (!supabase || !isSupabaseConfigured) return { error: null };
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email
    });
    return { error: error ? new Error(error.message) : null };
  };

  const demoLogin = (email: string) => {
    localStorage.setItem('tcf_demo_user', email);
    setUser({
      id: 'demo_user_id',
      email,
      email_confirmed_at: new Date().toISOString()
    } as unknown as User);
  };

  // Check email verification status
  const isEmailVerified = Boolean(
    user && (!isSupabaseConfigured || Boolean(user.email_confirmed_at || (user as any).confirmed_at))
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isConfigured: isSupabaseConfigured,
        isEmailVerified,
        signUp,
        signIn,
        signOut,
        resendVerification,
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
