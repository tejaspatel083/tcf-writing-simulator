import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/Header';

interface LoginProps {
  onSuccess: () => void;
  onHomeClick: () => void;
}

export const Login: React.FC<LoginProps> = ({ onSuccess, onHomeClick }) => {
  const { signIn, signUp, isConfigured } = useAuth();
  
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email || !password) {
      setErrorMsg('Veuillez remplir tous les champs.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setLoading(true);

    try {
      const res = isRegistering
        ? await signUp(email, password)
        : await signIn(email, password);

      if (res.error) {
        setErrorMsg(res.error.message);
      } else {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <Header onHomeClick={onHomeClick} subtitle="Espace d'authentification" />

      <div className="max-w-md mx-auto w-full px-6 py-12 flex-1 flex flex-col justify-center">
        <div className="bg-white border border-slate-300 rounded-lg shadow-xs p-6 sm:p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">
              {isRegistering ? 'Créer un compte' : 'Se connecter'}
            </h2>
            <p className="text-xs text-slate-600">
              {isRegistering
                ? 'Créez votre compte pour sauvegarder et consulter vos examens.'
                : 'Accédez à votre tableau de bord et à vos examens enregistrés.'}
            </p>
          </div>

          {!isConfigured && (
            <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded leading-relaxed">
              ℹ️ <strong>Mode Démo Actif :</strong> Les clés Supabase ne sont pas encore configurées dans <code>.env</code>. Vous pouvez tester la connexion directement.
            </div>
          )}

          {errorMsg && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded font-medium">
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
                placeholder="votre.email@exemple.com"
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
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded bg-blue-600 border border-blue-700 text-white font-bold text-sm hover:bg-blue-700 transition-colors shadow-xs mt-2 disabled:opacity-50"
            >
              {loading
                ? 'Chargement...'
                : isRegistering
                ? 'Créer mon compte'
                : 'Se connecter'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-200 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setErrorMsg(null);
              }}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline"
            >
              {isRegistering
                ? 'Vous avez déjà un compte ? Connectez-vous'
                : 'Pas encore de compte ? Inscrivez-vous'}
            </button>
          </div>
        </div>

        {/* Privacy Note */}
        <p className="text-center text-xs text-slate-500 mt-6 max-w-sm mx-auto leading-relaxed">
          🔒 Vos réponses rédigées sont enregistrées de façon confidentielle dans votre compte personnel uniquement. Vos soumissions ne sont jamais publiques.
        </p>
      </div>
    </div>
  );
};
