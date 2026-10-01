import React, { useState } from 'react';
import { TermsModal } from './TermsModal';
import { useLanguage } from '../context/LanguageContext';

interface FooterProps {
  onFeedbackClick?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onFeedbackClick }) => {
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <>
      <footer className="border-t border-slate-200 bg-white py-5 px-6 text-xs text-slate-500 shrink-0">
        <div className="max-w-4xl mx-auto flex flex-col gap-3">
          {/* Developer Information & Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-center sm:text-left">
              <span className="text-base">👨‍💻</span>
              <p className="text-slate-600">
                {t('Développé bénévolement par')}{' '}
                <strong className="text-slate-800 font-semibold">Tejas Patel</strong> •{' '}
                {t('Contact & Remerciements :')}{' '}
                <a
                  href="mailto:tejas083patel@gmail.com"
                  className="text-blue-700 hover:text-blue-900 font-medium underline"
                >
                  tejas083patel@gmail.com
                </a>
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onFeedbackClick && (
                <button
                  type="button"
                  onClick={onFeedbackClick}
                  className="inline-flex items-center gap-1.5 text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 font-semibold text-xs px-2.5 py-1 rounded transition-colors cursor-pointer"
                >
                  <span>💌</span>
                  <span>{t('Remerciements & Feedback')}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsTermsOpen(true)}
                className="text-slate-600 hover:text-slate-900 underline font-medium text-xs whitespace-nowrap cursor-pointer hover:bg-slate-100 px-2 py-1 rounded transition-colors"
              >
                {t("Conditions d'utilisation / Disclaimer")}
              </button>
            </div>
          </div>

          {/* Important Notice */}
          <p className="text-center sm:text-left text-slate-400 text-[11px] leading-relaxed">
            <span className="font-semibold text-slate-500">{t('⚠️ Avis important :')}</span>{' '}
            {t(
              "Ce site est uniquement un outil de pratique pour l'entraînement à l'écriture. Aucun droit d'auteur revendiqué — créé bénévolement pour aider les étudiants."
            )}
          </p>
        </div>
      </footer>

      <TermsModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} />
    </>
  );
};
