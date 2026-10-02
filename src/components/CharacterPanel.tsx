import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

interface CharacterPanelProps {
  onInsertCharacter: (char: string) => void;
}

export const CharacterPanel: React.FC<CharacterPanelProps> = ({ onInsertCharacter }) => {
  const { t } = useLanguage();
  const [isUppercase, setIsUppercase] = useState(false);

  const baseCharRows = [
    ['é', 'è', 'ê', 'ë', 'à'],
    ['â', 'ù', 'û', 'ç', 'ô'],
    ['œ', 'æ', '.', ',', ':'],
    ["'"]
  ];

  return (
    <div className="bg-white border border-slate-300 rounded-lg p-3 text-sm shadow-2xs">
      <div className="flex items-center justify-between mb-2 border-b border-slate-200 pb-1.5">
        <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide">
          {t('Tableau de caractère')}
        </h3>
        {isUppercase && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
            {t('Majuscules')}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {baseCharRows.map((row, rIdx) => {
          const isLastRow = rIdx === baseCharRows.length - 1;
          return (
            <div key={rIdx} className="flex gap-1.5 justify-start">
              {row.map((char) => {
                const displayChar = isUppercase ? char.toLocaleUpperCase('fr-FR') : char;
                return (
                  <button
                    key={char}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onInsertCharacter(displayChar);
                    }}
                    className="w-8 h-8 flex items-center justify-center bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100 transition-colors text-base shadow-2xs select-none cursor-pointer"
                    title={`${t('Insérer')} ${displayChar}`}
                  >
                    {displayChar}
                  </button>
                );
              })}

              {isLastRow && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setIsUppercase((prev) => !prev);
                  }}
                  className={`flex-1 h-8 flex items-center justify-center gap-1.5 px-2 rounded-lg font-bold text-xs transition-all border select-none cursor-pointer shadow-2xs ${
                    isUppercase
                      ? 'bg-blue-600 border-blue-700 text-white shadow-xs'
                      : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
                  }`}
                  title={
                    isUppercase
                      ? t('Passer en minuscules')
                      : t('Passer en majuscules (ex: É, À)')
                  }
                  aria-pressed={isUppercase}
                >
                  <span className="text-sm font-black leading-none">⇧</span>
                  <span>{isUppercase ? t('MAJ (Actif)') : t('Majuscules')}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
