import React from 'react';
import { CharacterPanel } from './CharacterPanel';
import { formatTime } from '../utils/wordCount';
import { useLanguage } from '../context/LanguageContext';

interface SubmissionPanelProps {
  timeRemainingSeconds: number;
  wordCounts: { task1: number; task2: number; task3: number };
  onInsertCharacter: (char: string) => void;
  isPracticeMode?: boolean;
  practiceTask?: string;
  practiceTasks?: ('task1' | 'task2' | 'task3')[];
}

export const SubmissionPanel: React.FC<SubmissionPanelProps> = ({
  timeRemainingSeconds,
  wordCounts,
  onInsertCharacter,
  isPracticeMode = false,
  practiceTask,
  practiceTasks
}) => {
  const { t } = useLanguage();
  const isUrgent = timeRemainingSeconds < 300; // less than 5 min

  const allConditions = [
    {
      key: 'task1',
      name: 'Tâche 1',
      min: 60,
      max: 120,
      count: wordCounts.task1
    },
    {
      key: 'task2',
      name: 'Tâche 2',
      min: 120,
      max: 150,
      count: wordCounts.task2
    },
    {
      key: 'task3',
      name: 'Tâche 3',
      min: 120,
      max: 180,
      count: wordCounts.task3
    }
  ];

  const activeFilterList = practiceTasks && practiceTasks.length > 0
    ? practiceTasks
    : typeof practiceTask === 'string'
    ? (practiceTask.split(',') as ('task1' | 'task2' | 'task3')[])
    : practiceTask
    ? [practiceTask as ('task1' | 'task2' | 'task3')]
    : null;

  const conditions = isPracticeMode && activeFilterList
    ? allConditions.filter((c) => activeFilterList.includes(c.key as any))
    : allConditions;

  return (
    <div className="bg-slate-50 border-l border-slate-200 w-72 shrink-0 p-3 flex flex-col gap-4 overflow-y-auto select-none">
      {/* Sleek Digital Countdown Timer */}
      <div className="bg-white border border-slate-300 rounded-lg p-3 shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-2">
          <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
            {t('Temps restant')}
          </h3>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
            {isUrgent ? 'URGENT' : 'CHRONO'}
          </span>
        </div>
        <div
          className={`flex items-center justify-center gap-2 text-2xl font-bold font-mono py-2 rounded-lg border transition-all ${
            isUrgent
              ? 'text-red-600 border-red-300 bg-red-50 animate-pulse shadow-2xs'
              : 'text-slate-800 border-slate-200 bg-slate-50 shadow-2xs'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isUrgent ? 'bg-red-500 animate-ping' : 'bg-blue-600'}`}></span>
          <span>{formatTime(timeRemainingSeconds)}</span>
        </div>
      </div>

      {/* Tableau de caractere */}
      <CharacterPanel onInsertCharacter={onInsertCharacter} />

      {/* Conditions de soumission */}
      <div className="bg-white border border-slate-300 rounded-lg p-3 text-xs shadow-2xs">
        <h3 className="font-bold text-slate-800 border-b border-slate-200 pb-1.5 mb-2.5 uppercase tracking-wider flex items-center justify-between">
          <span>{t('Conditions de soumission')}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
        </h3>
        <div className="space-y-3">
          {conditions.map((c) => {
            const isWithin = c.count >= c.min && c.count <= c.max;
            const isTooLow = c.count < c.min;
            return (
              <div key={c.key} className="border-b border-slate-100 pb-2.5 last:border-b-0 last:pb-0">
                <div className="font-semibold text-slate-800 flex justify-between items-center mb-1">
                  <span>{t(c.name)}:</span>
                  <span
                    className={`font-mono px-2 py-0.5 rounded font-bold text-[11px] border ${
                      isWithin
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-red-50 text-red-600 border-red-300'
                    }`}
                  >
                    {c.count} / {c.min}-{c.max}
                  </span>
                </div>
                <div
                  className={`text-[11px] font-bold ${
                    isWithin ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {isWithin ? (
                    t('✓ Nombre de mots conforme')
                  ) : isTooLow ? (
                    `${t('⚠️ Nombre de mots insuffisant')} (${c.count}/${c.min}-${c.max})`
                  ) : (
                    `${t('⚠️ Limite dépassée')} (${c.count}/${c.max})`
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
