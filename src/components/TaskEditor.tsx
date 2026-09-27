import React, { useEffect, useRef } from 'react';
import { TaskKey, TaskRequirement } from '../types/exam';
import { countFrenchWords } from '../utils/wordCount';
import { cleanDocumentText } from '../utils/cleanText';

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
  disabled = false
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
  const task3Title = taskRequirement.title || taskRequirement.instruction || '';

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden border-r border-slate-300">
      {/* Banner if Timer Finished */}
      {disabled && (
        <div className="bg-red-600 text-white font-bold text-xs px-4 py-2 flex items-center justify-between shadow-xs shrink-0">
          <span>⏱️ Temps écoulé ! La rédaction est désormais bloquée.</span>
          <span>Veuillez cliquer sur "Terminer l'examen" ci-dessous.</span>
        </div>
      )}

      {/* Task Prompt Area */}
      <div className="p-4 sm:p-5 border-b border-slate-300 bg-slate-50 max-h-[46vh] overflow-y-auto">
        {/* Header Bar matching Reference Website */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-extrabold shrink-0 shadow-2xs">
              {taskNumberMap[taskKey]}
            </span>
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
              Tâche {taskNumberMap[taskKey]}
            </h2>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span>{taskTypeMap[taskKey]}</span>
            <span>•</span>
            <span className="font-semibold text-slate-700">{taskRequirement.minWords}-{taskRequirement.maxWords} mots</span>
            {taskKey === 'task3' && (
              <>
                <span>•</span>
                <span>⏱️ 30 min</span>
              </>
            )}
          </div>
        </div>

        {/* Task Content */}
        {taskKey === 'task3' ? (
          <div className="space-y-3">
            {/* Centered Large Blue Title */}
            {task3Title && (
              <h3 className="text-center text-lg sm:text-xl font-extrabold text-blue-600 my-3 leading-snug">
                {task3Title}
              </h3>
            )}

            {/* Document 1 Card */}
            {doc1Clean && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-4.5 text-slate-800 text-sm leading-relaxed shadow-2xs hover:border-slate-300 transition-colors">
                <p className="whitespace-pre-line text-slate-800">{doc1Clean}</p>
              </div>
            )}

            {/* Document 2 Card */}
            {doc2Clean && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-4.5 text-slate-800 text-sm leading-relaxed shadow-2xs hover:border-slate-300 transition-colors">
                <p className="whitespace-pre-line text-slate-800">{doc2Clean}</p>
              </div>
            )}
          </div>
        ) : (
          /* Task 1 & Task 2 Instructions */
          <div className="text-slate-800 text-sm leading-relaxed whitespace-pre-line border-l-4 border-blue-600 pl-3.5 py-2.5 bg-white border border-slate-200 rounded-lg shadow-2xs">
            {taskRequirement.instruction || "Veuillez rédiger votre texte ci-dessous."}
          </div>
        )}
      </div>

      {/* Writing Textarea Area */}
      <div className="flex-1 p-4 flex flex-col relative bg-white">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={disabled ? "Temps écoulé — Rédaction désactivée." : "Saisissez votre texte ici..."}
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
              // Block Ctrl/Cmd + A (select all), Z (undo), Y (redo), C (copy), V (paste), X (cut)
              if (['a', 'z', 'y', 'c', 'v', 'x'].includes(key)) {
                e.preventDefault();
              }
            }
          }}
          className={`w-full flex-1 p-3 border rounded focus:outline-none resize-none font-sans text-base leading-relaxed ${
            disabled
              ? 'bg-slate-100 text-slate-500 border-slate-300 cursor-not-allowed'
              : 'bg-white text-slate-900 border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600'
          }`}
        />
      </div>

      {/* Footer / Status Bar */}
      <div className="px-4 py-3 border-t border-slate-300 bg-slate-50 flex items-center justify-between text-sm shrink-0">
        {/* Word Counter */}
        <div className="flex items-center gap-2">
          <span className={`font-bold font-mono text-base px-2 py-0.5 rounded border ${
            isWithinRange
              ? 'text-emerald-700 bg-emerald-50 border-emerald-300'
              : 'text-red-600 bg-red-50 border-red-300'
          }`}>
            {wordCount}
          </span>
          <span className="text-slate-600 font-medium">
            / ({taskRequirement.minWords}-{taskRequirement.maxWords} mots)
          </span>

          {isWithinRange && (
            <span className="bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs px-2.5 py-0.5 rounded font-bold ml-2">
              ✓ Nombre de mots conforme
            </span>
          )}

          {isTooLow && (
            <span className="bg-red-100 border border-red-300 text-red-800 text-xs px-2 py-0.5 rounded font-bold ml-2">
              ⚠️ Mots insuffisants ({wordCount}/{taskRequirement.minWords})
            </span>
          )}

          {isTooHigh && (
            <span className="bg-red-100 border border-red-300 text-red-800 text-xs px-2 py-0.5 rounded font-bold ml-2">
              ⚠️ Limite dépassée ({wordCount}/{taskRequirement.maxWords})
            </span>
          )}
        </div>

        {/* Navigation & Submit Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevTask}
            disabled={isFirstTask}
            className={`px-3 py-1.5 rounded border text-sm font-medium transition-colors cursor-pointer ${
              isFirstTask
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            Précédent
          </button>

          <button
            type="button"
            onClick={onNextTask}
            disabled={isLastTask}
            className={`px-3 py-1.5 rounded border text-sm font-medium transition-colors cursor-pointer ${
              isLastTask
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            Suivant
          </button>

          <button
            type="button"
            onClick={onFinishExam}
            className="px-4 py-1.5 rounded bg-blue-600 border border-blue-700 text-white font-bold text-sm hover:bg-blue-700 transition-colors ml-4 shadow-xs cursor-pointer"
          >
            Terminer l'examen
          </button>
        </div>
      </div>
    </div>
  );
};
