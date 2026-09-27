import React, { useState } from 'react';
import { TermsModal } from './TermsModal';

export const Footer: React.FC = () => {
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  return (
    <>
      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500 shrink-0">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-left text-slate-500 text-xs leading-relaxed">
            <span className="font-semibold text-slate-700">⚠️ Avis important :</span> Ce site est uniquement un outil de pratique pour l'entraînement à l'écriture. Aucun droit d'auteur revendiqué — créé bénévolement pour aider les étudiants.
          </p>
          <button
            type="button"
            onClick={() => setIsTermsOpen(true)}
            className="text-blue-700 hover:text-blue-900 underline font-semibold text-xs whitespace-nowrap cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors"
          >
            Conditions d'utilisation / Disclaimer
          </button>
        </div>
      </footer>

      <TermsModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} />
    </>
  );
};
