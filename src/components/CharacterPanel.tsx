import React from 'react';

interface CharacterPanelProps {
  onInsertCharacter: (char: string) => void;
}

export const CharacterPanel: React.FC<CharacterPanelProps> = ({ onInsertCharacter }) => {
  const charRows = [
    ['é', 'è', 'ê', 'ë', 'à'],
    ['â', 'ù', 'û', 'ç', 'ô'],
    ['œ', 'æ', '.', ',', ':'],
    ["'"]
  ];

  return (
    <div className="bg-white border border-slate-300 rounded p-3 text-sm">
      <h3 className="font-semibold text-slate-800 mb-2 border-b border-slate-200 pb-1 text-xs uppercase tracking-wide">
        Tableau de caractère
      </h3>
      <div className="space-y-1.5">
        {charRows.map((row, rIdx) => (
          <div key={rIdx} className="flex gap-1.5 justify-start">
            {row.map((char) => (
              <button
                key={char}
                type="button"
                onMouseDown={(e) => {
                  // Prevent default focus shift away from textarea
                  e.preventDefault();
                  onInsertCharacter(char);
                }}
                className="w-8 h-8 flex items-center justify-center bg-slate-50 border border-slate-300 rounded text-slate-800 font-medium hover:bg-slate-200 hover:border-slate-400 active:bg-blue-100 transition-colors text-base shadow-none"
                title={`Insérer ${char}`}
              >
                {char}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
