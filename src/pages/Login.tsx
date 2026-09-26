import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/Header';

interface LoginProps {
  onSuccess: () => void;
  onHomeClick?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onSuccess, onHomeClick }) => {
  const { signIn, signUp, resendVerification, isConfigured } = useAuth();
  
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [resending, setResending] = useState<boolean>(false);
  const [showResend, setShowResend] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setShowResend(false);

    if (!email || !password) {
      setErrorMsg('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    setLoading(true);

    try {
      if (isRegistering) {
        const res = await signUp(email, password);
        if (res.error) {
          setErrorMsg(res.error.message);
        } else if (res.needsVerification) {
          setInfoMsg(
            `Un lien de confirmation a été envoyé à ${email}. Veuillez ouvrir votre boîte de réception (et vérifier vos spams), cliquer sur le lien pour valider votre adresse, puis vous connecter.`
          );
          setIsRegistering(false);
          setShowResend(true);
        } else {
          onSuccess();
        }
      } else {
        const res = await signIn(email, password);
        if (res.error) {
          const msg = res.error.message.toLowerCase();
          if (msg.includes('email not confirmed') || msg.includes('not confirmed') || msg.includes('unconfirmed')) {
            setErrorMsg(
              "Votre adresse email n'a pas encore été confirmée. Veuillez vérifier votre boîte mail (et dossier spams) et cliquer sur le lien de confirmation."
            );
            setShowResend(true);
          } else if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
            setErrorMsg('Identifiants incorrects. Veuillez vérifier votre adresse e-mail et votre mot de passe.');
          } else {
            setErrorMsg(res.error.message);
          }
        } else {
          onSuccess();
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur inattendue est survenue.');
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
      const res = await resendVerification(email);
      if (res.error) {
        setErrorMsg(res.error.message);
      } else {
        setInfoMsg(`Nouveau lien de confirmation renvoyé avec succès à ${email}.`);
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
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-700 font-bold text-xl mb-3">
              {isRegistering ? '✍️' : '🔒'}
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-1">
              {isRegistering ? 'Créer un compte' : 'Connexion obligatoire'}
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              {isRegistering
                ? 'Créez votre compte candidat. Vous recevrez un email de validation obligatoire avant de pouvoir accéder au simulateur.'
                : 'Veuillez vous connecter avec votre adresse email vérifiée pour accéder à la plateforme TCF Écriture.'}
            </p>
          </div>

          {!isConfigured && (
            <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded leading-relaxed">
              ℹ️ <strong>Mode Démo Actif :</strong> Si Supabase n'est pas encore connecté, vous pouvez vous connecter immédiatement avec n'importe quelle adresse email.
            </div>
          )}

          {infoMsg && (
            <div className="mb-4 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs p-3.5 rounded font-medium leading-relaxed">
              📬 {infoMsg}
            </div>
          )}

          {errorMsg && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-xs p-3.5 rounded font-medium leading-relaxed">
              ⚠️ {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-slate-300 rounded text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
              <span className="block text-[11px] text-slate-500 mt-1">
                Minimum 6 caractères
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded bg-blue-600 border border-blue-700 text-white font-bold text-sm hover:bg-blue-700 transition-colors shadow-xs mt-2 disabled:opacity-50 cursor-pointer"
            >
              {loading
                ? 'Vérification en cours...'
                : isRegistering
                ? 'Créer mon compte et recevoir le lien'
                : 'Se connecter'}
            </button>
          </form>

          {showResend && (
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

          <div className="mt-6 pt-4 border-t border-slate-200 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setErrorMsg(null);
                setInfoMsg(null);
                setShowResend(false);
              }}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline cursor-pointer"
            >
              {isRegistering
                ? 'Déjà inscrit et email vérifié ? Connectez-vous'
                : 'Nouveau candidat ? Créer un compte'}
            </button>
          </div>
        </div>

        {/* Security & Validation details */}
        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg p-3.5 text-center">
          <p className="text-xs text-blue-800 font-medium">
            🔒 <strong>Accès sécurisé réservé aux candidats :</strong> La validation de votre adresse e-mail garantit la sauvegarde privée et individuelle de tous vos examens d'entraînement.
          </p>
        </div>
      </div>
    </div>
  );
};
