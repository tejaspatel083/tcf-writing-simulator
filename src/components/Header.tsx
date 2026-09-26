import React from 'react';

interface HeaderProps {
  onHomeClick?: () => void;
  onDashboardClick?: () => void;
  onLoginClick?: () => void;
  onLogoutClick?: () => void;
  userEmail?: string | null;
  subtitle?: string;
  combinationTitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onHomeClick,
  onDashboardClick,
  onLoginClick,
  onLogoutClick,
  userEmail,
  subtitle,
  combinationTitle
}) => {
  return (
    <header className="bg-white border-b border-slate-300 px-6 py-3 flex items-center justify-between shadow-none shrink-0 select-none">
      <div className="flex items-center gap-3">
        {onHomeClick && (
          <button
            type="button"
            onClick={onHomeClick}
            className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded hover:bg-blue-100 transition-colors"
          >
            ← Accueil
          </button>
        )}
        <div>
          <h1 className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
            TCF Écriture Simulator
          </h1>
          {subtitle && (
            <p className="text-xs text-slate-500 font-normal">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {combinationTitle && (
          <div className="text-xs font-medium text-slate-600 bg-slate-100 border border-slate-300 px-3 py-1 rounded hidden sm:block">
            {combinationTitle}
          </div>
        )}

        {/* Auth status buttons */}
        {userEmail ? (
          <div className="flex items-center gap-2">
            {onDashboardClick && (
              <button
                type="button"
                onClick={onDashboardClick}
                className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded hover:bg-blue-100 transition-colors"
              >
                Dashboard
              </button>
            )}
            {onLogoutClick && (
              <button
                type="button"
                onClick={onLogoutClick}
                className="text-xs font-medium text-slate-600 border border-slate-300 px-2.5 py-1 rounded hover:bg-slate-100 transition-colors"
              >
                Déconnexion
              </button>
            )}
          </div>
        ) : (
          onLoginClick && (
            <button
              type="button"
              onClick={onLoginClick}
              className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded hover:bg-blue-100 transition-colors"
            >
              Se connecter / Créer un compte
            </button>
          )
        )}
      </div>
    </header>
  );
};
