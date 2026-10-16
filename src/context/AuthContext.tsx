import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';
import { ADMIN_EMAIL, recordUserEmail } from '../services/adminService';

export const ADMIN_PASSWORD = 'Honey@083';

interface SignUpResult {
  error: Error | null;
  needsVerification?: boolean;
  alreadyExists?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  isEmailVerified: boolean;
  isPasswordRecovery: boolean;
  isAdmin: boolean;
  signUp: (email: string, pass: string) => Promise<SignUpResult>;
  signIn: (email: string, pass: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  clearPasswordRecovery: () => void;
  resendVerification: (email: string) => Promise<{ error: Error | null }>;
  demoLogin: (email: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function createAdminUserObject(): User {
  return {
    id: 'admin_tjp083_id',
    email: ADMIN_EMAIL,
    email_confirmed_at: new Date().toISOString(),
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: { role: 'admin', provider: 'email' },
    user_metadata: { role: 'admin', name: 'Administrateur (Tejas)' },
    created_at: new Date().toISOString()
  } as unknown as User;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(false);

  useEffect(() => {
    // 0. Check if admin was previously logged in on localhost
    try {
      const adminActive = localStorage.getItem('tcf_admin_logged_in') === 'true';
      if (adminActive) {
        setUser(createAdminUserObject());
        setLoading(false);
        return;
      }
    } catch (e) {
      console.warn('LocalStorage error checking admin:', e);
    }

    // Check if URL hash indicates a password recovery redirect
    if (window.location.hash && (window.location.hash.includes('type=recovery') || window.location.hash.includes('access_token='))) {
      if (window.location.hash.includes('type=recovery')) {
        setIsPasswordRecovery(true);
      }
    }

    if (!supabase || !isSupabaseConfigured) {
      // Check demo user in localStorage safely
      try {
        const demoEmail = localStorage.getItem('tcf_demo_user');
        if (demoEmail) {
          if (demoEmail.toLowerCase() === ADMIN_EMAIL) {
            setUser(createAdminUserObject());
          } else {
            setUser({
              id: 'demo_user_id',
              email: demoEmail,
              email_confirmed_at: new Date().toISOString()
            } as unknown as User);
          }
        }
      } catch (e) {
        console.warn('LocalStorage unavailable for demo user:', e);
      }
      setLoading(false);
      return;
    }

    // Safety timeout: on slow or throttled mobile networks, never block the app indefinitely
    const sessionTimeout = setTimeout(() => {
      setLoading((current) => {
        if (current) {
          console.warn('Supabase getSession timed out after 4 seconds; unblocking UI.');
          return false;
        }
        return false;
      });
    }, 4000);

    // Initialize Supabase Auth session with catch handler
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        clearTimeout(sessionTimeout);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch((err) => {
        clearTimeout(sessionTimeout);
        console.warn('Supabase getSession failed:', err);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      clearTimeout(sessionTimeout);
      setSession(session);
      setUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
      setLoading(false);
    });

    return () => {
      clearTimeout(sessionTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const getAuthRedirectUrl = (): string => {
    if (typeof window !== 'undefined' && window.location) {
      return window.location.origin + window.location.pathname;
    }
    return 'https://tejaspatel083.github.io/tcf-writing-simulator/';
  };

  const signUp = async (email: string, pass: string): Promise<SignUpResult> => {
    const normalized = email.trim().toLowerCase();
    recordUserEmail(normalized);

    // If registering admin email with the designated password
    if (normalized === ADMIN_EMAIL && pass === ADMIN_PASSWORD) {
      try {
        localStorage.setItem('tcf_admin_logged_in', 'true');
      } catch {}
      setUser(createAdminUserObject());
      return { error: null, needsVerification: false };
    }

    if (!supabase || !isSupabaseConfigured) {
      demoLogin(email);
      return { error: null, needsVerification: false };
    }

    const redirectUrl = getAuthRedirectUrl();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        emailRedirectTo: redirectUrl
      }
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes('already registered') ||
        msg.includes('already exists') ||
        msg.includes('user already registered') ||
        msg.includes('unique constraint')
      ) {
        return {
          error: new Error('Un compte existe déjà avec cette adresse e-mail. Veuillez vous connecter.'),
          alreadyExists: true
        };
      }
      return { error: new Error(error.message), needsVerification: false };
    }

    // Supabase behavior: If email already exists, identities is returned as empty list []
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return {
        error: new Error('Un compte existe déjà avec cette adresse e-mail. Veuillez vous connecter.'),
        alreadyExists: true
      };
    }

    const needsVerification = Boolean(data.user && (!data.session || !data.user.email_confirmed_at));
    return { error: null, needsVerification };
  };

  const signIn = async (email: string, pass: string) => {
    const normalized = email.trim().toLowerCase();

    // 1. Admin Login Verification (tejas083patel@gmail.com / Honey@083)
    const isAdminAttempt = normalized === ADMIN_EMAIL || normalized === 'tjp083@gmail.com';
    const cleanPass = pass.trim();

    if (isAdminAttempt) {
      if (cleanPass === ADMIN_PASSWORD || cleanPass.toLowerCase() === ADMIN_PASSWORD.toLowerCase()) {
        try {
          localStorage.setItem('tcf_admin_logged_in', 'true');
        } catch {}
        setUser(createAdminUserObject());
        return { error: null };
      } else {
        return { error: new Error('Mot de passe administrateur incorrect. (Attendu: Honey@083)') };
      }
    }

    // Record tracked user
    recordUserEmail(normalized);

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
    try {
      localStorage.removeItem('tcf_admin_logged_in');
      localStorage.removeItem('tcf_demo_user');
    } catch {}

    if (supabase && isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Error during signOut:', e);
      }
    }

    setUser(null);
    setSession(null);
    setIsPasswordRecovery(false);
  };

  const resetPassword = async (email: string) => {
    if (!supabase || !isSupabaseConfigured) {
      return {
        error: new Error(
          "Supabase n'est pas encore configuré sur cet environnement (clé API manquante dans .env)."
        )
      };
    }
    const redirectUrl = getAuthRedirectUrl();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectUrl
    });
    return { error: error ? new Error(error.message) : null };
  };

  const updatePassword = async (newPassword: string) => {
    if (!supabase || !isSupabaseConfigured) {
      return { error: null };
    }
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    if (!error) {
      setIsPasswordRecovery(false);
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
    return { error: error ? new Error(error.message) : null };
  };

  const clearPasswordRecovery = () => {
    setIsPasswordRecovery(false);
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  };

  const resendVerification = async (email: string) => {
    if (!supabase || !isSupabaseConfigured) return { error: null };
    const redirectUrl = getAuthRedirectUrl();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { error: error ? new Error(error.message) : null };
  };

  const demoLogin = (email: string) => {
    const normalized = email.trim().toLowerCase();
    recordUserEmail(normalized);

    if (normalized === ADMIN_EMAIL) {
      try {
        localStorage.setItem('tcf_admin_logged_in', 'true');
      } catch {}
      setUser(createAdminUserObject());
      return;
    }

    try {
      localStorage.setItem('tcf_demo_user', email);
    } catch {}
    setUser({
      id: 'demo_user_id',
      email,
      email_confirmed_at: new Date().toISOString()
    } as unknown as User);
  };

  // Check email verification status
  const isEmailVerified = Boolean(
    user && (user.email?.toLowerCase() === ADMIN_EMAIL || !isSupabaseConfigured || Boolean(user.email_confirmed_at || (user as any).confirmed_at))
  );

  const isAdmin = Boolean(user && user.email?.toLowerCase() === ADMIN_EMAIL);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isConfigured: isSupabaseConfigured,
        isEmailVerified,
        isPasswordRecovery,
        isAdmin,
        signUp,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
        clearPasswordRecovery,
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
