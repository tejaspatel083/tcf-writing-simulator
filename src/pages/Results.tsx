import React, { useState } from 'react';
import { ExamResult, TaskKey } from '../types/exam';
import { formatTime } from '../utils/wordCount';
import { cleanDocumentText, fixMojibake, normalizeParagraphText } from '../utils/cleanText';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { useLanguage } from '../context/LanguageContext';

interface ResultsProps {
  result: ExamResult;
  onHomeClick: () => void;
  onFeedbackClick?: () => void;
}

export const Results: React.FC<ResultsProps> = ({ result, onHomeClick, onFeedbackClick }) => {
  const { t } = useLanguage();
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

  const practiceKeys: TaskKey[] = result.practiceTasks && result.practiceTasks.length > 0
    ? result.practiceTasks
    : typeof result.practiceTask === 'string'
    ? (result.practiceTask.split(',').map((s) => s.trim()).filter(Boolean) as TaskKey[])
    : result.practiceTask
    ? [result.practiceTask as TaskKey]
    : [];

  const isPractice = !!result.isPracticeMode && practiceKeys.length > 0;

  const allTasksList = [
    { key: 'task1' as TaskKey, name: 'Tâche 1', req: result.combination.tasks.task1 },
    { key: 'task2' as TaskKey, name: 'Tâche 2', req: result.combination.tasks.task2 },
    { key: 'task3' as TaskKey, name: 'Tâche 3', req: result.combination.tasks.task3 }
  ];

  const tasksList = isPractice
    ? allTasksList.filter((t) => practiceKeys.includes(t.key))
    : allTasksList;

  const practiceTitle = practiceKeys
    .map((k) => t(k === 'task1' ? 'Tâche 1' : k === 'task2' ? 'Tâche 2' : 'Tâche 3'))
    .join(' + ');

  const handleCopyPracticed = () => {
    let fullText = `TCF CANADA - ENTRAÎNEMENT PRATIQUE
Combinaison ${result.combination.combinationNumber} (${result.month} ${result.year})
Temps utilisé : ${formatTime(result.timeUsedSeconds)}${result.allocatedMinutes ? ` / ${result.allocatedMinutes} min` : ''}
`;
    tasksList.forEach((tItem) => {
      const ans = result.answers[tItem.key] || '(Aucune réponse)';
      const wc = result.wordCounts[tItem.key];
      fullText += `\n--- ${tItem.name.toUpperCase()} (${wc} mots / ${tItem.req.minWords}-${tItem.req.maxWords}) ---\n`;
      fullText += `Consigne : ${normalizeParagraphText(tItem.req.title || tItem.req.instruction)}\n`;
      if (tItem.req.document1) fullText += `Document 1 :\n${cleanDocumentText(tItem.req.document1)}\n\n`;
      if (tItem.req.document2) fullText += `Document 2 :\n${cleanDocumentText(tItem.req.document2)}\n\n`;
      fullText += `Réponse :\n${ans}\n`;
    });

    navigator.clipboard.writeText(fullText);
    setCopiedTask('practiced_all');
    setTimeout(() => setCopiedTask(null), 2000);
  };

  const isSinglePractice = isPractice && practiceKeys.length === 1;
  const singleTaskObj = tasksList[0] || allTasksList[0];
  const singleCount = result.wordCounts[singleTaskObj.key];
  const singleMin = singleTaskObj.req.minWords;
  const singleMax = singleTaskObj.req.maxWords;
  const isSingleWithin = singleCount >= singleMin && singleCount <= singleMax;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header
        onHomeClick={onHomeClick}
        subtitle={isPractice ? t("Compte-rendu d'entraînement") : t("Compte-rendu de votre session")}
        combinationTitle={`${t('Combinaison')} ${result.combination.combinationNumber} — ${t(result.month)} ${result.year}`}
      />

      <div className="w-full px-4 sm:px-8 lg:px-12 py-6 sm:py-8 flex-1">
        {/* Main Summary Card */}
        <div className="bg-white border border-slate-300 rounded-lg shadow-xs p-6 mb-8">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b border-slate-200 pb-5 mb-6 gap-4">
            <div className="space-y-2 flex-1 min-w-0">
              {/* Badges Row */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                  {isPractice ? t('Entraînement Pratique') : t('Examen Complet')}
                </span>

                {isPractice && (
                  <span className="text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full font-mono">
                    {practiceKeys.map((k) => `T${k.slice(-1)}`).join(' + ')}
                  </span>
                )}

                <span className="text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded">
                  {t('Combinaison')} {result.combination.combinationNumber} • {t(result.month)} {result.year}
                </span>
              </div>

              {/* Title */}
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-snug">
                {isPractice
                  ? `${t('Entraînement terminé')} : ${practiceTitle}`
                  : t('Examen officiel terminé')}
              </h1>

              {/* Description */}
              <p className="text-xs sm:text-sm text-slate-500">
                {isPractice
                  ? t("Voici le récapitulatif de votre session. Vous pouvez copier votre texte pour l'évaluer ou le conserver.")
                  : t("Voici le récapitulatif complet de vos réponses pour évaluation avec votre tuteur.")}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="shrink-0 self-start sm:self-center">
              <button
                type="button"
                onClick={isPractice ? handleCopyPracticed : handleCopyAll}
                className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <span>📋</span>
                <span>
                  {copiedTask === (isPractice ? 'practiced_all' : 'all')
                    ? t('Copié !')
                    : isPractice
                    ? t('Copier mes rédactions')
                    : t('Copier tout pour mon tuteur')}
                </span>
              </button>
            </div>
          </div>

          {/* Unified Clean Stats Grid */}
          <div className="mb-6 p-3 sm:p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className={`grid gap-3 ${
              isSinglePractice
                ? 'grid-cols-1 sm:grid-cols-3'
                : (isPractice && tasksList.length === 2)
                ? 'grid-cols-1 sm:grid-cols-3'
                : 'grid-cols-2 md:grid-cols-4'
            }`}>
              {/* Card 1: Time */}
              <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    {t('Temps utilisé')}
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold font-mono text-slate-900 flex items-baseline gap-1">
                    {formatTime(result.timeUsedSeconds)}
                    <span className="text-xs text-slate-400 font-normal font-sans">
                      / {result.allocatedMinutes || 60} min
                    </span>
                  </div>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-600">
                    ⏱️ {isPractice ? t('Entraînement') : t('Conditions réelles')}
                  </span>
                  <span className="text-slate-400 font-medium">
                    {result.allocatedMinutes || 60} min
                  </span>
                </div>
              </div>

              {/* If Single Task Practice: Card 2 = Words, Card 3 = Objective */}
              {isSinglePractice ? (
                <>
                  <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        {t('Nombre de mots')}
                      </div>
                      <div className="text-xl sm:text-2xl font-extrabold font-mono text-slate-900 flex items-baseline gap-1">
                        {singleCount} <span className="text-xs text-slate-500 font-normal font-sans">{t('mots')}</span>
                      </div>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span
                        className={`font-bold px-2 py-0.5 rounded border inline-block ${
                          isSingleWithin
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-red-50 text-red-600 border-red-300'
                        }`}
                      >
                        {isSingleWithin ? t('✓ Conforme') : t('⚠️ Non conforme')}
                      </span>
                      <span className="text-slate-400 font-medium font-mono">
                        {singleMin}–{singleMax} {t('mots')}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        {t('Objectif exigé')}
                      </div>
                      <div className="text-xl sm:text-2xl font-extrabold font-mono text-slate-900 flex items-baseline gap-1">
                        {singleMin}–{singleMax} <span className="text-xs text-slate-500 font-normal font-sans">{t('mots')}</span>
                      </div>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="text-slate-600 font-medium">
                        {t(singleTaskObj.name)}
                      </span>
                      <span className="text-emerald-700 font-bold">
                        TCF Canada
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                /* Multi-Task Practice (2 or 3 tasks) OR Full Exam */
                (isPractice ? tasksList : allTasksList).map((tItem) => {
                  const count = result.wordCounts[tItem.key] || 0;
                  const min = tItem.req.minWords;
                  const max = tItem.req.maxWords;
                  const isWithin = count >= min && count <= max;

                  return (
                    <div key={tItem.key} className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs flex flex-col justify-between">
                      <div>
                        <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          {t(tItem.name)}
                        </div>
                        <div className="text-xl sm:text-2xl font-extrabold font-mono text-slate-900 flex items-baseline gap-1">
                          {count} <span className="text-xs text-slate-500 font-normal font-sans">{t('mots')}</span>
                        </div>
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-[11px]">
                        <span
                          className={`font-bold px-2 py-0.5 rounded border text-[10px] sm:text-[11px] whitespace-nowrap ${
                            isWithin
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : 'bg-red-50 text-red-600 border-red-300'
                          }`}
                        >
                          {isWithin ? t('✓ Conforme') : t('⚠️ Non conforme')}
                        </span>
                        <span className="text-slate-400 font-mono text-[10px] sm:text-[11px] whitespace-nowrap">
                          {min}–{max}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Individual Tasks Display */}
          <div className="space-y-6">
            {tasksList.map((tItem) => {
              const text = result.answers[tItem.key];
              const count = result.wordCounts[tItem.key];
              const min = tItem.req.minWords;
              const max = tItem.req.maxWords;
              const isWithin = count >= min && count <= max;

              return (
                <div key={tItem.key} className="border border-slate-300 rounded p-4 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                    <h3 className="font-bold text-slate-800 text-base">
                      {t(tItem.name)}
                    </h3>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded font-bold border ${
                        isWithin
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : 'bg-red-50 text-red-600 border-red-300'
                      }`}>
                        {count} / {min}-{max} {t('mots')}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(tItem.key, `Sujet: ${tItem.req.instruction || tItem.req.title}\n\nRéponse:\n${text}`)}
                        className="text-xs font-semibold text-blue-700 hover:text-blue-900 border border-blue-200 bg-blue-50 px-2.5 py-1 rounded"
                      >
                        {copiedTask === tItem.key ? t('Copié !') : t('Copier cette tâche')}
                      </button>
                    </div>
                  </div>

                  {/* Task Instruction / Documents */}
                  <div className="text-xs text-slate-700 bg-slate-50 p-3.5 rounded-lg border border-slate-200 mb-3 leading-relaxed">
                    {tItem.req.title && (
                      <div className="font-bold text-sm text-blue-700 mb-2">
                        {normalizeParagraphText(tItem.req.title)}
                      </div>
                    )}
                    {tItem.key !== 'task3' && (
                      <div>
                        <strong>{t('Consigne :')}</strong> {normalizeParagraphText(tItem.req.instruction)}
                      </div>
                    )}
                    {tItem.req.document1 && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-200">
                        <strong className="text-slate-900 block mb-1">{t('Document 1 :')}</strong>
                        <p className="whitespace-pre-line text-slate-700">{cleanDocumentText(tItem.req.document1)}</p>
                      </div>
                    )}
                    {tItem.req.document2 && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-200">
                        <strong className="text-slate-900 block mb-1">{t('Document 2 :')}</strong>
                        <p className="whitespace-pre-line text-slate-700">{cleanDocumentText(tItem.req.document2)}</p>
                      </div>
                    )}
                  </div>

                  {/* User Response Text */}
                  <div className="bg-slate-50 border border-slate-200 rounded p-4 font-sans text-sm leading-relaxed text-slate-900 whitespace-pre-wrap min-h-[100px]">
                    {text ? text : <span className="italic text-slate-400">{t('Aucune réponse rédigée.')}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
            <button
              type="button"
              onClick={onHomeClick}
              className="w-full sm:w-auto px-5 py-2.5 rounded bg-blue-600 border border-blue-700 text-white font-bold text-sm hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
            >
              {t("Retour à l'accueil")}
            </button>

            {onFeedbackClick && (
              <button
                type="button"
                onClick={onFeedbackClick}
                className="w-full sm:w-auto px-4 py-2 rounded bg-blue-50 border border-blue-200 text-blue-700 font-semibold text-xs hover:bg-blue-100 transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>💌</span>
                <span>{t('Un mot pour le développeur / Feedback')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <Footer onFeedbackClick={onFeedbackClick} />
    </div>
  );
};
