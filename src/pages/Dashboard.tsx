import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchSubmissionsFromSupabase, deleteSubmissionFromSupabase } from '../lib/supabase';
import { getStoredSubmissions, deleteStoredSubmission, mergeSubmissions, syncStoredSubmissions } from '../utils/storage';
import { ExamResult, TaskKey } from '../types/exam';
import { formatTime } from '../utils/wordCount';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { useLanguage } from '../context/LanguageContext';

interface DashboardProps {
  onStartNewExam: () => void;
  onViewSubmission: (result: ExamResult) => void;
  onRetakeCombination: (combo: any, year: string, month: string) => void;
  onHomeClick: () => void;
  onFeedbackClick?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onStartNewExam,
  onViewSubmission,
  onRetakeCombination,
  onHomeClick,
  onFeedbackClick
}) => {
  const { user, signOut, isConfigured } = useAuth();
  const { t } = useLanguage();
  const [submissions, setSubmissions] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const local = getStoredSubmissions();
      setSubmissions(local);

      if (user && isConfigured) {
        try {
          const { submissions: dbSubs, error } = await fetchSubmissionsFromSupabase(user.id);
          if (!error && dbSubs && dbSubs.length > 0) {
            const merged = mergeSubmissions(dbSubs, local);
            setSubmissions(merged);
            syncStoredSubmissions(merged);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.error('Error fetching submissions for dashboard:', e);
        }
      }

      setLoading(false);
    }

    loadData();
  }, [user, isConfigured]);

  const handleDeleteSubmission = async (sub: ExamResult) => {
    if (!sub.id) return;
    const comboNum = sub.combination?.combinationNumber || sub.combination?.combination;
    const confirmed = window.confirm(
      `Voulez-vous vraiment supprimer cette soumission (${sub.month} ${sub.year} — Combinaison ${comboNum}) ?`
    );
    if (!confirmed) return;

    // 1. Delete from local storage
    deleteStoredSubmission(sub.id);

    // 2. Delete from Supabase if logged in
    if (user && isConfigured) {
      try {
        await deleteSubmissionFromSupabase(sub.id, user.id);
      } catch (err) {
        console.error('Erreur lors de la suppression sur Supabase:', err);
      }
    }

    // 3. Update state immediately
    setSubmissions((prev) => prev.filter((item) => item.id !== sub.id));
  };

  const displayName = user?.email ? user.email.split('@')[0] : 'Utilisateur';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <Header
        onHomeClick={onHomeClick}
        onFeedbackClick={onFeedbackClick}
        userEmail={user?.email}
        subtitle={t('Tableau de bord utilisateur')}
      />

      <div className="w-full px-4 sm:px-8 lg:px-12 py-6 sm:py-8 flex-1">
        {/* User Greeting & Primary CTA */}
        <div className="bg-white border border-slate-300 rounded-lg p-5 sm:p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
              {t('Bonjour,')} <span className="text-blue-700">{displayName}</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {user?.email} • {t('Bienvenue sur votre tableau de bord personnel.')}
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onStartNewExam}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>+</span>
              <span>{t('Commencer un nouvel examen')}</span>
            </button>

            <button
              type="button"
              onClick={signOut}
              className="px-3.5 py-2.5 rounded border border-slate-300 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {t('Déconnexion')}
            </button>
          </div>
        </div>

        {/* Previous Exam Submissions Table / List */}
        <div className="bg-white border border-slate-300 rounded-lg p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-6">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                {t('Mes examens précédents')}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('Consultez le détail de vos rédactions passées et leur nombre de mots.')}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-slate-500 text-sm font-medium">
              {t('Chargement de vos soumissions...')}
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-10 text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-6">
              <p className="text-sm font-medium text-slate-700 mb-2">
                {t('Aucun examen enregistré pour le moment.')}
              </p>
              <button
                type="button"
                onClick={onStartNewExam}
                className="inline-block px-5 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors mt-1 cursor-pointer shadow-xs"
              >
                {t('Passer votre premier examen')}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase font-bold text-slate-700 bg-slate-50">
                    <th className="py-3 px-3.5">{t('Date')}</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">{t('Série / Combinaison')}</th>
                    <th className="py-3 px-3.5">{t('Tâche 1')}</th>
                    <th className="py-3 px-3.5">{t('Tâche 2')}</th>
                    <th className="py-3 px-3.5">{t('Tâche 3')}</th>
                    <th className="py-3 px-3.5 text-left whitespace-nowrap">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {submissions.map((sub) => {
                    const comboNum = sub.combination?.combinationNumber || sub.combination?.combination;
                    const isPract = !!sub.isPracticeMode && (!!sub.practiceTasks || !!sub.practiceTask);
                    
                    // Determine which tasks were practiced (supports 1, 2, or 3 tasks)
                    const activeTasksList: TaskKey[] = sub.practiceTasks && sub.practiceTasks.length > 0
                      ? sub.practiceTasks
                      : typeof sub.practiceTask === 'string'
                      ? (sub.practiceTask.split(',') as TaskKey[])
                      : sub.practiceTask
                      ? [sub.practiceTask as TaskKey]
                      : [];

                    const practLabel = activeTasksList.length > 0
                      ? `${t('Pratique')} ${activeTasksList.map((k) => `T${k.slice(-1)}`).join(' + ')}`
                      : t('Pratique');

                    const t1Ok = sub.wordCounts.task1 >= 60 && sub.wordCounts.task1 <= 120;
                    const t2Ok = sub.wordCounts.task2 >= 120 && sub.wordCounts.task2 <= 150;
                    const t3Ok = sub.wordCounts.task3 >= 120 && sub.wordCounts.task3 <= 180;

                    // Split date and time (e.g. "02/10/2026 10:07")
                    const dateParts = sub.date ? sub.date.split(/(?: à |[ ,]+)/) : [];
                    const dPart = dateParts[0] || sub.date || '—';
                    const tPart = dateParts.length >= 2 ? dateParts[1] : '';

                    return (
                      <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3.5 font-medium text-slate-800 text-xs whitespace-nowrap">
                          <div className="flex flex-col leading-tight">
                            <span className="font-semibold">{dPart}</span>
                            {tPart && (
                              <span className="text-[11px] text-slate-500 font-mono mt-0.5">
                                {tPart}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 font-medium text-slate-800 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 font-bold text-slate-900">
                              <span>{sub.year} / {t(sub.month)} / {t('Combinaison')} {comboNum}</span>
                            </div>
                            {isPract && (
                              <div>
                                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded whitespace-nowrap inline-block">
                                  {practLabel}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3.5">
                          {isPract && !activeTasksList.includes('task1') ? (
                            <span className="text-slate-400 text-xs font-mono">—</span>
                          ) : (
                            <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold border inline-block ${
                              t1Ok
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : 'bg-red-50 text-red-600 border-red-300'
                            }`}>
                              {sub.wordCounts.task1} {t('mots')}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5">
                          {isPract && !activeTasksList.includes('task2') ? (
                            <span className="text-slate-400 text-xs font-mono">—</span>
                          ) : (
                            <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold border inline-block ${
                              t2Ok
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : 'bg-red-50 text-red-600 border-red-300'
                            }`}>
                              {sub.wordCounts.task2} {t('mots')}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5">
                          {isPract && !activeTasksList.includes('task3') ? (
                            <span className="text-slate-400 text-xs font-mono">—</span>
                          ) : (
                            <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold border inline-block ${
                              t3Ok
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : 'bg-red-50 text-red-600 border-red-300'
                            }`}>
                              {sub.wordCounts.task3} {t('mots')}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-left whitespace-nowrap">
                          <div className="flex items-center justify-start gap-2">
                            <button
                              type="button"
                              onClick={() => onViewSubmission(sub)}
                              className="px-2.5 py-1 rounded bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors cursor-pointer"
                            >
                              {t('Voir')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSubmission(sub)}
                              className="w-7 h-7 flex items-center justify-center rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors cursor-pointer"
                              title={t('Supprimer cette soumission')}
                              aria-label={t('Supprimer')}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Confidentiality / Privacy Notice */}
        <div className="mt-8 bg-slate-100 border border-slate-200 rounded p-4 text-xs text-slate-600 leading-relaxed">
          🔒 <strong>{t('Respect de la vie privée :')}</strong> {t("Vos réponses rédigées sont enregistrées de façon confidentielle dans votre compte personnel uniquement. Vos soumissions ne sont jamais publiques, aucun profil public n'est généré, et aucun classement n'est partagé.")}
        </div>
      </div>

      <Footer onFeedbackClick={onFeedbackClick} />
    </div>
  );
};
