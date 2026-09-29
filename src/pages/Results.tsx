import React, { useState } from 'react';
import { ExamResult } from '../types/exam';
import { formatTime } from '../utils/wordCount';
import { cleanDocumentText, fixMojibake, normalizeParagraphText } from '../utils/cleanText';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

interface ResultsProps {
  result: ExamResult;
  onHomeClick: () => void;
}

export const Results: React.FC<ResultsProps> = ({ result, onHomeClick }) => {
  const [copiedTask, setCopiedTask] = useState<string | null>(null);

  const handleCopyAll = () => {
    const fullText = `TCF CANADA - EXPRESSION ÉCRITE
Combinaison ${result.combination.combinationNumber} (${result.month} ${result.year})
Temps utilisé : ${formatTime(result.timeUsedSeconds)}

--- TÂCHE 1 (${result.wordCounts.task1} mots / 60-120) ---
Consigne : ${normalizeParagraphText(result.combination.tasks.task1.instruction)}

Réponse :
${result.answers.task1 || '(Aucune réponse)'}

--- TÂCHE 2 (${result.wordCounts.task2} mots / 120-150) ---
Consigne : ${normalizeParagraphText(result.combination.tasks.task2.instruction)}

Réponse :
${result.answers.task2 || '(Aucune réponse)'}

--- TÂCHE 3 (${result.wordCounts.task3} mots / 120-180) ---
Consigne : ${normalizeParagraphText(result.combination.tasks.task3.title || result.combination.tasks.task3.instruction)}
${result.combination.tasks.task3.document1 ? `Document - 1 :\n${cleanDocumentText(result.combination.tasks.task3.document1)}\n\n` : ''}${result.combination.tasks.task3.document2 ? `Document - 2 :\n${cleanDocumentText(result.combination.tasks.task3.document2)}\n\n` : ''}
Réponse :
${result.answers.task3 || '(Aucune réponse)'}
`;
    navigator.clipboard.writeText(fullText);
    setCopiedTask('all');
    setTimeout(() => setCopiedTask(null), 2000);
  };

  const handleCopy = (taskKey: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTask(taskKey);
    setTimeout(() => setCopiedTask(null), 2000);
  };

  const isPractice = !!result.isPracticeMode && !!result.practiceTask;
  const singleTaskKey = result.practiceTask || 'task1';

  const allTasksList = [
    { key: 'task1' as const, name: 'Tâche 1', req: result.combination.tasks.task1 },
    { key: 'task2' as const, name: 'Tâche 2', req: result.combination.tasks.task2 },
    { key: 'task3' as const, name: 'Tâche 3', req: result.combination.tasks.task3 }
  ];

  const tasksList = isPractice
    ? allTasksList.filter((t) => t.key === singleTaskKey)
    : allTasksList;

  const practicedTaskObj = allTasksList.find((t) => t.key === singleTaskKey) || allTasksList[0];
  const singleCount = result.wordCounts[singleTaskKey];
  const singleMin = practicedTaskObj.req.minWords;
  const singleMax = practicedTaskObj.req.maxWords;
  const isSingleWithin = singleCount >= singleMin && singleCount <= singleMax;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header
        onHomeClick={onHomeClick}
        subtitle={isPractice ? "Compte-rendu d'entraînement individuel" : "Compte-rendu de votre session"}
        combinationTitle={`Combinaison ${result.combination.combinationNumber} — ${result.month} ${result.year}`}
      />

      <div className="max-w-4xl mx-auto w-full px-6 py-8 flex-1">
        {/* Main Summary Card */}
        <div className="bg-white border border-slate-300 rounded-lg shadow-xs p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 mb-6 gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-2xl font-bold text-slate-900">
                  {isPractice ? `Entraînement terminé — ${practicedTaskObj.name}` : "Examen terminé"}
                </h2>
                {isPractice && (
                  <span className="text-xs font-bold text-blue-800 bg-blue-100 border border-blue-300 px-2.5 py-0.5 rounded-full">
                    Pratique libre
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600">
                {isPractice
                  ? "Voici le récapitulatif de votre rédaction sur cette tâche. Vous pouvez copier votre texte pour l'évaluer ou le conserver."
                  : "Voici le récapitulatif complet de vos réponses pour évaluation avec votre tuteur."}
              </p>
            </div>

            <button
              type="button"
              onClick={isPractice ? () => handleCopy(singleTaskKey, `Sujet: ${practicedTaskObj.req.instruction || practicedTaskObj.req.title}\n\nRéponse:\n${result.answers[singleTaskKey]}`) : handleCopyAll}
              className="px-4 py-2 rounded bg-blue-600 border border-blue-700 text-white font-bold text-sm hover:bg-blue-700 transition-colors shadow-xs shrink-0 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>📋</span>
              <span>
                {copiedTask === (isPractice ? singleTaskKey : 'all')
                  ? 'Copié !'
                  : isPractice
                  ? 'Copier ma rédaction'
                  : 'Copier tout pour mon tuteur'}
              </span>
            </button>
          </div>

          {isPractice ? (
            /* Single Task Stats Grid */
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 bg-slate-50 p-4 rounded border border-slate-200">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Temps utilisé
                </div>
                <div className="text-xl font-bold font-mono text-slate-800 mt-1">
                  {formatTime(result.timeUsedSeconds)}
                  {result.allocatedMinutes && (
                    <span className="text-xs text-slate-500 font-normal font-sans ml-1">
                      / {result.allocatedMinutes} min
                    </span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Nombre de mots
                </div>
                <div className="text-xl font-bold font-mono text-slate-800 mt-1 flex items-center gap-2">
                  <span>{singleCount} mots</span>
                  <span
                    className={`text-xs font-sans px-2 py-0.5 rounded font-bold border ${
                      isSingleWithin
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-red-50 text-red-600 border-red-300'
                    }`}
                  >
                    {isSingleWithin ? '✓ Conforme' : '⚠️ Non conforme'}
                  </span>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Objectif exigé
                </div>
                <div className="text-xl font-bold font-mono text-slate-800 mt-1">
                  {singleMin} – {singleMax} mots
                </div>
              </div>
            </div>
          ) : (
            /* Full Exam Stats Grid */
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6 bg-slate-50 p-4 rounded border border-slate-200">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Temps utilisé
                </div>
                <div className="text-xl font-bold font-mono text-slate-800 mt-1">
                  {formatTime(result.timeUsedSeconds)}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Tâche 1
                </div>
                <div className="text-xl font-bold font-mono text-slate-800 mt-1">
                  {result.wordCounts.task1} mots
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Tâche 2
                </div>
                <div className="text-xl font-bold font-mono text-slate-800 mt-1">
                  {result.wordCounts.task2} mots
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Tâche 3
                </div>
                <div className="text-xl font-bold font-mono text-slate-800 mt-1">
                  {result.wordCounts.task3} mots
                </div>
              </div>
            </div>
          )}

          {/* Individual Tasks Display */}
          <div className="space-y-6">
            {tasksList.map((t) => {
              const text = result.answers[t.key];
              const count = result.wordCounts[t.key];
              const min = t.req.minWords;
              const max = t.req.maxWords;
              const isWithin = count >= min && count <= max;

              return (
                <div key={t.key} className="border border-slate-300 rounded p-4 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                    <h3 className="font-bold text-slate-800 text-base">
                      {t.name}
                    </h3>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded font-bold border ${
                        isWithin
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : 'bg-red-50 text-red-600 border-red-300'
                      }`}>
                        {count} / {min}-{max} mots
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(t.key, `Sujet: ${t.req.instruction}\n\nRéponse:\n${text}`)}
                        className="text-xs font-semibold text-blue-700 hover:text-blue-900 border border-blue-200 bg-blue-50 px-2.5 py-1 rounded"
                      >
                        {copiedTask === t.key ? 'Copié !' : 'Copier cette tâche'}
                      </button>
                    </div>
                  </div>

                  {/* Task Instruction / Documents */}
                  <div className="text-xs text-slate-700 bg-slate-50 p-3.5 rounded-lg border border-slate-200 mb-3 leading-relaxed">
                    {t.req.title && (
                      <div className="font-bold text-sm text-blue-700 mb-2">
                        {normalizeParagraphText(t.req.title)}
                      </div>
                    )}
                    {t.key !== 'task3' && (
                      <div>
                        <strong>Consigne :</strong> {normalizeParagraphText(t.req.instruction)}
                      </div>
                    )}
                    {t.req.document1 && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-200">
                        <strong className="text-slate-900 block mb-1">Document 1 :</strong>
                        <p className="whitespace-pre-line text-slate-700">{cleanDocumentText(t.req.document1)}</p>
                      </div>
                    )}
                    {t.req.document2 && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-200">
                        <strong className="text-slate-900 block mb-1">Document 2 :</strong>
                        <p className="whitespace-pre-line text-slate-700">{cleanDocumentText(t.req.document2)}</p>
                      </div>
                    )}
                  </div>

                  {/* User Response Text */}
                  <div className="bg-slate-50 border border-slate-200 rounded p-4 font-sans text-sm leading-relaxed text-slate-900 whitespace-pre-wrap min-h-[100px]">
                    {text ? text : <span className="italic text-slate-400">Aucune réponse rédigée.</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-center">
            <button
              type="button"
              onClick={onHomeClick}
              className="px-5 py-2.5 rounded bg-blue-600 border border-blue-700 text-white font-bold text-sm hover:bg-blue-700 transition-colors shadow-xs"
            >
              Retour à l'accueil
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
