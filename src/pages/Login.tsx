import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/Header';
import { Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onSuccess: () => void;
  onHomeClick?: () => void;
}

type AuthMode = 'login' | 'register' | 'forgot' | 'recovery';

export const Login: React.FC<LoginProps> = ({ onSuccess, onHomeClick }) => {
  const {
    signIn,
    signUp,
    resetPassword,
    updatePassword,
    resendVerification,
    isConfigured,
    isPasswordRecovery,
    clearPasswordRecovery
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');

  // Form states
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(false);

  // Password visibility states
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  // Feedback states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [resending, setResending] = useState<boolean>(false);
  const [showResend, setShowResend] = useState<boolean>(false);
  const [emailAlreadyExists, setEmailAlreadyExists] = useState<boolean>(false);

  // Load remembered email on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('tcf_remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // Enter password recovery mode if user arrives via password reset link
  useEffect(() => {
    if (isPasswordRecovery) {
      setMode('recovery');
      setErrorMsg(null);
      setInfoMsg('Veuillez saisir votre nouveau mot de passe ci-dessous.');
    }
  }, [isPasswordRecovery]);

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setErrorMsg(null);
    setInfoMsg(null);
    setShowResend(false);
    setEmailAlreadyExists(false);
    setPassword('');
    setConfirmPassword('');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setShowResend(false);

    if (!email || !password) {
      setErrorMsg('Veuillez renseigner votre adresse e-mail et votre mot de passe.');
      return;
    }

    setLoading(true);

    try {
      const res = await signIn(email.trim(), password);

      if (res.error) {
        const msg = res.error.message.toLowerCase();
        if (msg.includes('email not confirmed') || msg.includes('not confirmed') || msg.includes('unconfirmed')) {
          setErrorMsg(
            "Votre adresse e-mail n'a pas encore été confirmée. Veuillez ouvrir votre messagerie et cliquer sur le lien de confirmation."
          );
          setShowResend(true);
        } else if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
          setErrorMsg('Identifiants incorrects. Veuillez vérifier votre adresse e-mail et votre mot de passe.');
        } else {
          setErrorMsg(res.error.message);
        }
      } else {
        // Handle "Remember Me"
        if (rememberMe) {
          localStorage.setItem('tcf_remembered_email', email.trim());
        } else {
          localStorage.removeItem('tcf_remembered_email');
        }
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur inattendue est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setShowResend(false);
    setEmailAlreadyExists(false);

    if (!email || !password || !confirmPassword) {
      setErrorMsg('Veuillez renseigner tous les champs obligatoires.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);

    try {
      const res = await signUp(email.trim(), password);

      if (res.error) {
        if (res.alreadyExists) {
          setEmailAlreadyExists(true);
          setErrorMsg('Un compte existe déjà avec cette adresse e-mail. Veuillez vous connecter.');
        } else {
          setErrorMsg(res.error.message);
        }
      } else if (res.needsVerification) {
        setInfoMsg(
          `Un lien de confirmation a été envoyé à ${email}. Veuillez ouvrir votre boîte de réception (et vérifier vos spams), cliquer sur le lien pour valider votre compte, puis vous connecter.`
        );
        setShowResend(true);
        switchMode('login');
      } else {
        if (rememberMe) {
          localStorage.setItem('tcf_remembered_email', email.trim());
        }
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur inattendue est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!email) {
      setErrorMsg('Veuillez saisir votre adresse e-mail.');
      return;
    }

    setLoading(true);

    try {
      const res = await resetPassword(email.trim());
      if (res.error) {
        setErrorMsg(res.error.message);
      } else {
        setInfoMsg(
          `Si un compte est associé à l'adresse ${email}, vous allez recevoir un e-mail avec un lien pour réinitialiser votre mot de passe.`
        );
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur inattendue est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!password || !confirmPassword) {
      setErrorMsg('Veuillez saisir et confirmer votre nouveau mot de passe.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Le nouveau mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);

    try {
      const res = await updatePassword(password);
      if (res.error) {
        setErrorMsg(res.error.message);
      } else {
        clearPasswordRecovery();
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la mise à jour.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!email) {
      setErrorMsg('Veuillez saisir votre adresse email pour renvoyer le lien.');
      return;
    }
    setResending(true);
    setErrorMsg(null);
    try {
      const res = await resendVerification(email.trim());
      if (res.error) {
        setErrorMsg(res.error.message);
      } else {
        setInfoMsg(`Un nouveau lien de validation a été envoyé à ${email}.`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur lors de l'envoi.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <Header
        onHomeClick={onHomeClick}
        subtitle="Accès obligatoire par authentification"
      />

      <div className="max-w-md mx-auto w-full px-6 py-8 flex-1 flex flex-col justify-center">
        <div className="bg-white border border-slate-300 rounded-lg shadow-sm p-6 sm:p-8">
          
          {/* Header Icon & Title */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-700 font-bold text-xl mb-3">
              {mode === 'register' && '✍️'}
              {mode === 'login' && '🔒'}
              {mode === 'forgot' && '🔑'}
              {mode === 'recovery' && '🛡️'}
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-1">
              {mode === 'register' && 'Créer un compte'}
              {mode === 'login' && 'Connexion candidat'}
              {mode === 'forgot' && 'Mot de passe oublié'}
              {mode === 'recovery' && 'Nouveau mot de passe'}
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              {mode === 'register' &&
                'Créez votre compte unique. Une vérification par e-mail est obligatoire avant votre premier accès.'}
              {mode === 'login' &&
                'Connectez-vous avec votre adresse e-mail vérifiée pour accéder au simulateur TCF.'}
              {mode === 'forgot' &&
                'Saisissez votre adresse e-mail pour recevoir les instructions de réinitialisation.'}
              {mode === 'recovery' &&
                'Choisissez un mot de passe sécurisé pour réactiver l’accès à votre compte.'}
            </p>
          </div>

          {infoMsg && (
            <div className="mb-4 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs p-3.5 rounded font-medium leading-relaxed">
              📬 {infoMsg}
            </div>
          )}

          {errorMsg && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-xs p-3.5 rounded font-medium leading-relaxed">
              ⚠️ {errorMsg}
              {emailAlreadyExists && (
                <div className="mt-2 pt-2 border-t border-red-200">
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="text-xs font-bold text-blue-700 hover:text-blue-900 underline cursor-pointer"
                  >
                    → Cliquer ici pour vous connecter avec ce compte
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 1. LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Adresse e-mail
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="candidat.tcf@exemple.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Mot de passe
                  </label>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-xs text-blue-700 hover:text-blue-900 font-medium underline cursor-pointer"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer"
                />
                <label htmlFor="remember-me" className="ml-2 block text-xs text-slate-700 font-medium cursor-pointer">
                  Se souvenir de moi (mémoriser mon adresse e-mail)
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded bg-blue-600 border border-blue-700 text-white font-bold text-sm hover:bg-blue-700 transition-colors shadow-xs mt-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Connexion en cours...' : 'Se connecter'}
              </button>
            </form>
          )}

          {/* 2. REGISTER FORM */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Adresse e-mail
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="candidat.tcf@exemple.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span className="block text-[11px] text-slate-500 mt-1">
                  Minimum 6 caractères
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Confirmer le mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label={showConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  id="remember-me-reg"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer"
                />
                <label htmlFor="remember-me-reg" className="ml-2 block text-xs text-slate-700 font-medium cursor-pointer">
                  Mémoriser mon adresse e-mail sur cet appareil
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded bg-blue-600 border border-blue-700 text-white font-bold text-sm hover:bg-blue-700 transition-colors shadow-xs mt-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Création en cours...' : 'Créer mon compte et recevoir le lien'}
              </button>
            </form>
          )}

          {/* 3. FORGOT PASSWORD FORM */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Votre adresse e-mail
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="candidat.tcf@exemple.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded bg-blue-600 border border-blue-700 text-white font-bold text-sm hover:bg-blue-700 transition-colors shadow-xs mt-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Envoi en cours...' : 'Envoyer le lien de réinitialisation'}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-xs text-slate-600 hover:text-slate-900 font-medium underline cursor-pointer"
                >
                  ← Retour à la connexion
                </button>
              </div>
            </form>
          )}

          {/* 4. RECOVERY (SET NEW PASSWORD) FORM */}
          {mode === 'recovery' && (
            <form onSubmit={handleRecoverySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span className="block text-[11px] text-slate-500 mt-1">
                  Minimum 6 caractères
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Confirmer le nouveau mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label={showConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded bg-emerald-600 border border-emerald-700 text-white font-bold text-sm hover:bg-emerald-700 transition-colors shadow-xs mt-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Mise à jour en cours...' : 'Enregistrer le nouveau mot de passe'}
              </button>
            </form>
          )}

          {/* Resend email confirmation */}
          {showResend && mode !== 'forgot' && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={handleResendEmail}
                disabled={resending}
                className="text-xs text-blue-700 hover:text-blue-900 font-semibold underline cursor-pointer disabled:opacity-50"
              >
                {resending ? "Renvoi en cours..." : "Renvoyer l'email de confirmation"}
              </button>
            </div>
          )}

          {/* Switch between Login and Register */}
          {mode !== 'forgot' && mode !== 'recovery' && (
            <div className="mt-6 pt-4 border-t border-slate-200 text-center">
              <button
                type="button"
                onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline cursor-pointer"
              >
                {mode === 'register'
                  ? 'Vous avez déjà un compte ? Connectez-vous'
                  : 'Nouveau candidat ? Créer un compte'}
              </button>
            </div>
          )}
        </div>

        {/* Security Note */}
        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg p-3.5 text-center">
          <p className="text-xs text-blue-800 font-medium">
            🔒 <strong>1 compte = 1 adresse e-mail unique :</strong> Vos rédactions et vos statistiques d'examen sont protégées de manière sécurisée et confidentielle.
          </p>
        </div>
      </div>
    </div>
  );
};
