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
  signUp: (email: string, pass: string, name?: string) => Promise<SignUpResult>;
  signIn: (email: string, pass: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  clearPasswordRecovery: () => void;
  resendVerification: (email: string) => Promise<{ error: Error | null }>;
  demoLogin: (email: string) => void;
  userName: string;
  updateUserName: (name: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function getUserDisplayName(u: User | null): string {
  if (!u) return 'Utilisateur';
  const email = u.email?.trim().toLowerCase();
  if (email) {
    const local = localStorage.getItem(`tcf_user_name_${email}`);
    if (local && local.trim().length > 0) return local.trim();
  }
  const metaName = (u.user_metadata as any)?.name || (u.user_metadata as any)?.full_name;
  if (metaName && typeof metaName === 'string' && metaName.trim().length > 0) {
    return metaName.trim();
  }
  return email ? email.split('@')[0] : 'Utilisateur';
}

function createAdminUserObject(): User {
  const savedName = localStorage.getItem(`tcf_user_name_${ADMIN_EMAIL.toLowerCase()}`);
  return {
    id: 'admin_tjp083_id',
    email: ADMIN_EMAIL,
    email_confirmed_at: new Date().toISOString(),
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: { role: 'admin', provider: 'email' },
    user_metadata: { role: 'admin', name: savedName || 'Administrateur (Tejas)' },
    created_at: new Date().toISOString()
  } as unknown as User;
}

function createLocalUserObject(email: string): User {
  const norm = email.trim().toLowerCase();
  const savedName = localStorage.getItem(`tcf_user_name_${norm}`);
  return {
    id: `local_user_${norm.replace(/[^a-z0-9]/g, '_')}`,
    email: norm,
    email_confirmed_at: new Date().toISOString(),
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: { provider: 'email' },
    user_metadata: { name: savedName || norm.split('@')[0] },
    created_at: new Date().toISOString()
  } as unknown as User;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(false);
  const [userName, setUserName] = useState<string>(() => getUserDisplayName(null));

  useEffect(() => {
    setUserName(getUserDisplayName(user));
  }, [user]);

  const updateUserName = async (newName: string): Promise<{ error: Error | null }> => {
    const trimmed = newName.trim();
    if (!trimmed) {
      return { error: new Error('Le nom ne peut pas être vide.') };
    }

    if (user?.email) {
      localStorage.setItem(`tcf_user_name_${user.email.trim().toLowerCase()}`, trimmed);
    }
    setUserName(trimmed);

    setUser((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        user_metadata: {
          ...(prev.user_metadata || {}),
          name: trimmed,
          full_name: trimmed
        }
      };
    });

    if (supabase && isSupabaseConfigured && user && !user.id.startsWith('local_user_') && user.id !== 'admin_tjp083_id') {
      try {
        await supabase.auth.updateUser({
          data: { name: trimmed, full_name: trimmed }
        });
      } catch (e) {
        console.warn('Could not update user metadata on Supabase:', e);
      }
    }

    return { error: null };
  };

  useEffect(() => {
    // 0. Check if admin or local candidate was previously logged in on localhost
    try {
      const adminActive = localStorage.getItem('tcf_admin_logged_in') === 'true';
      if (adminActive) {
        setUser(createAdminUserObject());
        setLoading(false);
        return;
      }

      const localUserEmail = localStorage.getItem('tcf_local_user_email');
      if (localUserEmail) {
        setUser(createLocalUserObject(localUserEmail));
        setLoading(false);
        return;
      }
    } catch (e) {
      console.warn('LocalStorage error checking local session:', e);
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

  const signUp = async (email: string, pass: string, name?: string): Promise<SignUpResult> => {
    const normalized = email.trim().toLowerCase();
    recordUserEmail(normalized);

    const trimmedName = name?.trim();
    if (trimmedName) {
      try {
        localStorage.setItem(`tcf_user_name_${normalized}`, trimmedName);
      } catch {}
      setUserName(trimmedName);
    }

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

    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    const redirectUrl = getAuthRedirectUrl();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        emailRedirectTo: redirectUrl,
        data: trimmedName ? { name: trimmedName, full_name: trimmedName } : undefined
      }
    });

    if (error) {
      if (isLocalhost) {
        try {
          localStorage.setItem('tcf_local_user_email', email.trim().toLowerCase());
        } catch {}
        setUser(createLocalUserObject(email));
        return { error: null, needsVerification: false };
      }

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

    if (isLocalhost) {
      try {
        localStorage.setItem('tcf_local_user_email', email.trim().toLowerCase());
        if (trimmedName) {
          localStorage.setItem(`tcf_user_name_${email.trim().toLowerCase()}`, trimmedName);
        }
      } catch {}
      setUser(createLocalUserObject(email));
      return { error: null, needsVerification: false };
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

    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    if (!supabase || !isSupabaseConfigured) {
      demoLogin(email);
      return { error: null };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass
    });

    if (error) {
      if (isLocalhost) {
        console.info(`[Localhost Dev] Supabase auth returned: "${error.message}". Logging in locally as candidate for ${normalized}.`);
        try {
          localStorage.setItem('tcf_local_user_email', normalized);
        } catch {}
        setUser(createLocalUserObject(normalized));
        return { error: null };
      }

      return { error: new Error(error.message) };
    }

    return { error: null };
  };

  const signOut = async () => {
    try {
      localStorage.removeItem('tcf_admin_logged_in');
      localStorage.removeItem('tcf_local_user_email');
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
    user && (
      user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() ||
      user.email?.toLowerCase() === 'tjp083@gmail.com' ||
      !isSupabaseConfigured ||
      Boolean(user.email_confirmed_at || (user as any).confirmed_at)
    )
  );

  const isAdmin = Boolean(
    (user && (
      user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() ||
      user.email?.toLowerCase() === 'tjp083@gmail.com' ||
      user.app_metadata?.role === 'admin' ||
      user.user_metadata?.role === 'admin'
    )) || (typeof window !== 'undefined' && localStorage.getItem('tcf_admin_logged_in') === 'true')
  );

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
        demoLogin,
        userName,
        updateUserName
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
