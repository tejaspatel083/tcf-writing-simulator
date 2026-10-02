import React from 'react';
import { useLanguage } from '../context/LanguageContext';

interface HeaderProps {
  onHomeClick?: () => void;
  onDashboardClick?: () => void;
  onFeedbackClick?: () => void;
  onLoginClick?: () => void;
  onLogoutClick?: () => void;
  userEmail?: string | null;
  subtitle?: string;
  combinationTitle?: string;
  forceFrench?: boolean;
  hideLanguageToggle?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onHomeClick,
  onDashboardClick,
  onFeedbackClick,
  onLoginClick,
  onLogoutClick,
  userEmail,
  subtitle,
  combinationTitle,
  forceFrench = false,
  hideLanguageToggle = false
}) => {
  const { language, setLanguage, t } = useLanguage();

  const tr = (keyOrText: string): string => {
    if (forceFrench) {
      if (keyOrText === 'header.home') return 'Accueil';
      if (keyOrText === 'header.title') return 'TCF Canada Expression Écrite';
      if (keyOrText === 'header.dashboard') return 'Tableau de bord';
      if (keyOrText === 'header.logout') return 'Déconnexion';
      if (keyOrText === 'header.login') return 'Se connecter';
      return keyOrText;
    }
    return t(keyOrText);
  };

  return (
    <header className="bg-white border-b border-slate-300 px-6 py-3 flex items-center justify-between shadow-none shrink-0 select-none">
      <div className="flex items-center gap-3">
        {onHomeClick && (
          <button
            type="button"
            onClick={onHomeClick}
            className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded hover:bg-blue-100 transition-colors cursor-pointer"
          >
            {tr('header.home')}
          </button>
        )}
        <div>
          <h1 className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
            {tr('header.title')}
          </h1>
          {subtitle && (
            <p className="text-xs text-slate-500 font-normal">{tr(subtitle)}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {combinationTitle && (
          <div className="text-xs font-medium text-slate-600 bg-slate-100 border border-slate-300 px-3 py-1 rounded hidden sm:block">
            {tr(combinationTitle)}
          </div>
        )}

        {/* Language Switcher Toggle - hidden during exam with 60min timer */}
        {!hideLanguageToggle && !forceFrench && (
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-300 text-xs font-bold">
            <button
              type="button"
              onClick={() => setLanguage('fr')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                language === 'fr'
                  ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Passer en français"
            >
              FR
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                language === 'en'
                  ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Switch to English"
            >
              EN
            </button>
          </div>
        )}

        {/* Feedback Link */}
        {onFeedbackClick && (
          <button
            type="button"
            onClick={onFeedbackClick}
            className="text-xs font-semibold text-slate-700 hover:text-blue-700 hover:bg-slate-100 border border-slate-300 px-2.5 py-1 rounded transition-colors cursor-pointer hidden sm:inline-flex items-center gap-1"
            title={t('Envoyer un feedback ou des remerciements')}
          >
            <span>💬</span>
            <span>{t('Feedback')}</span>
          </button>
        )}

        {/* Auth status buttons */}
        {userEmail ? (
          <div className="flex items-center gap-2">
            {onDashboardClick && (
              <button
                type="button"
                onClick={onDashboardClick}
                className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded hover:bg-blue-100 transition-colors cursor-pointer"
              >
                {tr('header.dashboard')}
              </button>
            )}
            {onLogoutClick && (
              <button
                type="button"
                onClick={onLogoutClick}
                className="text-xs font-medium text-slate-600 border border-slate-300 px-2.5 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {tr('header.logout')}
              </button>
            )}
          </div>
        ) : (
          onLoginClick && (
            <button
              type="button"
              onClick={onLoginClick}
              className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded hover:bg-blue-100 transition-colors cursor-pointer"
            >
              {tr('header.login')}
            </button>
          )
        )}
      </div>
    </header>
  );
};
