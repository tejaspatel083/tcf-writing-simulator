import React, { useEffect, useRef } from 'react';
import { TaskKey, TaskRequirement } from '../types/exam';
import { countFrenchWords } from '../utils/wordCount';
import { cleanDocumentText, fixMojibake, normalizeParagraphText } from '../utils/cleanText';
import { useLanguage } from '../context/LanguageContext';

interface TaskEditorProps {
  taskKey: TaskKey;
  taskRequirement: TaskRequirement;
  value: string;
  onChange: (val: string) => void;
  onPrevTask: () => void;
  onNextTask: () => void;
  onFinishExam: () => void;
  isFirstTask: boolean;
  isLastTask: boolean;
  disabled?: boolean;
  isPracticeMode?: boolean;
}

export const TaskEditor: React.FC<TaskEditorProps> = ({
  taskKey,
  taskRequirement,
  value,
  onChange,
  onPrevTask,
  onNextTask,
  onFinishExam,
  isFirstTask,
  isLastTask,
  disabled = false,
  isPracticeMode = false
}) => {
  const { t } = useLanguage();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isPromptOpen, setIsPromptOpen] = React.useState<boolean>(true);
  const wordCount = countFrenchWords(value);

  // Keep focus on textarea when task changes
  useEffect(() => {
    if (textareaRef.current && !disabled) {
      textareaRef.current.focus();
    }
  }, [taskKey, disabled]);

  const taskNumberMap: Record<TaskKey, number> = {
    task1: 1,
    task2: 2,
    task3: 3
  };

  const taskTypeMap: Record<TaskKey, string> = {
    task1: 'Description / Message',
    task2: 'Narration / Récit',
    task3: 'Argumentation'
  };

  const isWithinRange = wordCount >= taskRequirement.minWords && wordCount <= taskRequirement.maxWords;
  const isTooLow = wordCount < taskRequirement.minWords;
  const isTooHigh = wordCount > taskRequirement.maxWords;

  const doc1Clean = cleanDocumentText(taskRequirement.document1);
  const doc2Clean = cleanDocumentText(taskRequirement.document2);
  const task3Title = normalizeParagraphText(taskRequirement.title || taskRequirement.instruction || '');

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden border-r border-slate-300">
      {/* Banner if Timer Finished */}
      {disabled && (
        <div className="bg-red-600 text-white font-bold text-xs px-4 py-2 flex items-center justify-between shadow-xs shrink-0">
          <span>{t("⏱️ Temps écoulé ! La rédaction est désormais bloquée.")}</span>
          <span>{t('Veuillez cliquer sur "Terminer l\'examen" ci-dessous.')}</span>
        </div>
      )}

      {/* Task Prompt Accordion Panel */}
      <div className="border-b border-slate-300 bg-white transition-all shadow-none">
        {/* Accordion Header */}
        <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {taskNumberMap[taskKey]}
            </span>
            <h2 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight">
              {t(`Tâche ${taskNumberMap[taskKey]}`)}
            </h2>
            <span className="text-xs text-slate-400 hidden sm:inline">•</span>
            <span className="text-xs text-slate-600 font-medium hidden sm:inline">{t(taskTypeMap[taskKey])}</span>
            <span className="text-[11px] font-semibold text-slate-600 bg-white border border-slate-300 px-2 py-0.5 rounded font-mono">
              {taskRequirement.minWords}–{taskRequirement.maxWords} {t('mots')}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsPromptOpen(!isPromptOpen)}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1.5"
            title={isPromptOpen ? t('Masquer la consigne') : t('Afficher la consigne')}
          >
            <span className="text-[10px] text-blue-600 font-bold">{isPromptOpen ? '▲' : '▼'}</span>
            <span className="hidden sm:inline">{isPromptOpen ? t('Masquer la consigne') : t('Afficher la consigne')}</span>
          </button>
        </div>

        {/* Accordion Body */}
        {isPromptOpen && (
          <div className="p-4 sm:p-5 max-h-[38vh] overflow-y-auto bg-white space-y-3">
            {taskKey === 'task3' ? (
              <div className="space-y-3">
                {task3Title && (
                  <h3 className="text-center text-base sm:text-lg font-bold text-slate-800 my-2 leading-snug border-b border-slate-200 pb-2">
                    {task3Title}
                  </h3>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {doc1Clean && (
                    <div className="bg-slate-50 border border-slate-200 rounded p-3.5 text-slate-800 text-xs sm:text-sm leading-relaxed">
                      <div className="font-bold text-xs text-blue-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                        <span>{t('Document 1 :').replace(' :', '')}</span>
                      </div>
                      <p className="whitespace-pre-line text-slate-700">{doc1Clean}</p>
                    </div>
                  )}

                  {doc2Clean && (
                    <div className="bg-slate-50 border border-slate-200 rounded p-3.5 text-slate-800 text-xs sm:text-sm leading-relaxed">
                      <div className="font-bold text-xs text-blue-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                        <span>{t('Document 2 :').replace(' :', '')}</span>
                      </div>
                      <p className="whitespace-pre-line text-slate-700">{doc2Clean}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-slate-800 text-sm leading-relaxed whitespace-pre-line border-l-4 border-blue-600 pl-3 py-1 bg-slate-50 rounded-r">
                {normalizeParagraphText(taskRequirement.instruction) || t("Veuillez rédiger votre texte ci-dessous.")}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Editor Workspace */}
      <div className="flex-1 p-3 sm:p-4 flex flex-col relative bg-slate-50/50">
        <div className="relative flex-1 flex flex-col bg-white rounded border border-slate-300 shadow-2xs overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
          {/* Live Floating Word Counter Badge */}
          <div className="absolute top-3 right-3 z-10 pointer-events-none">
            <div className={`px-2.5 py-1 rounded text-xs font-bold font-mono border backdrop-blur-md shadow-2xs flex items-center gap-1.5 ${
              isWithinRange
                ? 'bg-emerald-50/95 text-emerald-800 border-emerald-300'
                : isTooHigh
                ? 'bg-red-50/95 text-red-600 border-red-300'
                : 'bg-white/95 text-slate-700 border-slate-300'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isWithinRange ? 'bg-emerald-600' : isTooHigh ? 'bg-red-600' : 'bg-slate-400'}`}></span>
              <span>{wordCount} / {taskRequirement.minWords}–{taskRequirement.maxWords} {t('mots')}</span>
            </div>
          </div>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={disabled ? t("Temps écoulé — Rédaction désactivée.") : t("Saisissez votre texte ici...")}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            onCopy={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            onPaste={(e) => e.preventDefault()}
            onDrop={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              const isCtrlOrCmd = e.ctrlKey || e.metaKey;
              if (isCtrlOrCmd) {
                const key = e.key.toLowerCase();
                if (['a', 'z', 'y', 'c', 'v', 'x'].includes(key)) {
                  e.preventDefault();
                }
              }
            }}
            className={`w-full flex-1 p-4 sm:p-5 focus:outline-none resize-none font-sans text-base leading-relaxed bg-white text-slate-900 ${
              disabled ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
            }`}
          />
        </div>
      </div>

      {/* Footer / Status Bar */}
      <div className="px-4 sm:px-6 py-2.5 border-t border-slate-300 bg-white flex flex-col sm:flex-row items-center justify-between text-sm shrink-0 gap-3">
        {/* Word Counter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-bold font-mono text-base px-2.5 py-0.5 rounded border ${
            isWithinRange
              ? 'text-emerald-800 bg-emerald-50 border-emerald-300'
              : 'text-red-600 bg-red-50 border-red-300'
          }`}>
            {wordCount}
          </span>
          <span className="text-slate-600 font-medium text-xs sm:text-sm">
            / ({taskRequirement.minWords}–{taskRequirement.maxWords} {t('mots')})
          </span>

          {isWithinRange && (
            <span className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs px-2.5 py-0.5 rounded font-bold ml-1 inline-flex items-center gap-1">
              <span>✓</span> {t('✓ Nombre de mots conforme')}
            </span>
          )}

          {isTooLow && (
            <span className="bg-red-50 border border-red-300 text-red-600 text-xs px-2.5 py-0.5 rounded font-bold ml-1 inline-flex items-center gap-1">
              <span>⚠️</span> {t('⚠️ Mots insuffisants')} ({wordCount}/{taskRequirement.minWords})
            </span>
          )}

          {isTooHigh && (
            <span className="bg-red-50 border border-red-300 text-red-600 text-xs px-2.5 py-0.5 rounded font-bold ml-1 inline-flex items-center gap-1">
              <span>⚠️</span> {t('⚠️ Limite dépassée')} ({wordCount}/{taskRequirement.maxWords})
            </span>
          )}
        </div>

        {/* Navigation & Action Buttons */}
        <div className="flex items-center gap-2.5">
          {!isPracticeMode && (
            <>
              <button
                type="button"
                onClick={onPrevTask}
                disabled={isFirstTask}
                className={`px-3.5 py-1.5 rounded border text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                  isFirstTask
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {t('Précédent')}
              </button>

              <button
                type="button"
                onClick={onNextTask}
                disabled={isLastTask}
                className={`px-3.5 py-1.5 rounded border text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                  isLastTask
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {t('Suivant')}
              </button>
            </>
          )}

          {/* Action Button */}
          <button
            type="button"
            onClick={onFinishExam}
            className={`px-4 sm:px-5 py-2 rounded bg-blue-600 hover:bg-blue-700 border border-blue-700 text-white font-bold text-xs sm:text-sm transition-colors shadow-xs cursor-pointer flex items-center gap-1.5 ${
              !isPracticeMode ? 'ml-2' : ''
            }`}
          >
            <span>✓</span>
            <span>{isPracticeMode ? t("Terminer l'entraînement") : t("Terminer l'examen")}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
