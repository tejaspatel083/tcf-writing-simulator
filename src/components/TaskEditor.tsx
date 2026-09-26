import React, { useEffect, useRef } from 'react';
import { TaskKey, TaskRequirement } from '../types/exam';
import { countFrenchWords } from '../utils/wordCount';

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

  const taskTitleMap: Record<TaskKey, string> = {
    task1: 'Tâche 1',
    task2: 'Tâche 2',
    task3: 'Tâche 3'
  };

  const isWithinRange = wordCount >= taskRequirement.minWords && wordCount <= taskRequirement.maxWords;
  const isTooLow = wordCount < taskRequirement.minWords;
  const isTooHigh = wordCount > taskRequirement.maxWords;

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
      <div className="p-4 border-b border-slate-300 bg-slate-50 max-h-[40vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-slate-800 mb-2">
          {taskTitleMap[taskKey]}
        </h2>

        {/* Task Instruction */}
        <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-line border-l-4 border-blue-600 pl-3 py-1 bg-white border rounded shadow-xs mb-3">
          {taskRequirement.instruction || "Veuillez rédiger votre texte ci-dessous."}
        </div>

        {/* Documents for Task 3 */}
        {taskKey === 'task3' && (
          <div className="space-y-3 mt-3">
            {taskRequirement.document1 && (
              <div className="bg-white border border-slate-300 rounded p-3">
                <div className="font-semibold text-xs text-blue-700 uppercase tracking-wide mb-1">
                  Document 1
                </div>
                <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                  {taskRequirement.document1}
                </div>
              </div>
            )}
            {taskRequirement.document2 && (
              <div className="bg-white border border-slate-300 rounded p-3">
                <div className="font-semibold text-xs text-blue-700 uppercase tracking-wide mb-1">
                  Document 2
                </div>
                <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                  {taskRequirement.document2}
                </div>
              </div>
            )}
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
      <div className="px-4 py-3 border-t border-slate-300 bg-slate-50 flex items-center justify-between text-sm">
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
            className={`px-3 py-1.5 rounded border text-sm font-medium transition-colors ${
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
            className={`px-3 py-1.5 rounded border text-sm font-medium transition-colors ${
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
            className="px-4 py-1.5 rounded bg-blue-600 border border-blue-700 text-white font-bold text-sm hover:bg-blue-700 transition-colors ml-4 shadow-xs"
          >
            Terminer l'examen
          </button>
        </div>
      </div>
    </div>
  );
};
