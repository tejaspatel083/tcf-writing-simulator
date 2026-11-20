import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchSubmissionsFromSupabase, deleteSubmissionFromSupabase } from '../lib/supabase';
import { getStoredSubmissions, deleteStoredSubmission, mergeSubmissions, syncStoredSubmissions } from '../utils/storage';
import { getStoredMistakes, mergeMistakesFromSubmissions } from '../utils/mistakesStorage';
import { ExamResult, TaskKey } from '../types/exam';
import { SavedMistake } from '../types/aiEvaluation';
import { MistakesView } from '../components/MistakesView';
import { useLanguage } from '../context/LanguageContext';
import { getCandidateSubmissionsAndMistakes } from '../services/userProfilesService';
import {
  ClipboardList,
  AlertCircle,
  Eye,
  Trash2,
  RotateCcw,
  PlusCircle,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Award,
  BookOpen
} from 'lucide-react';

interface MySubmissionsProps {
  initialTab?: 'exams' | 'mistakes';
  onStartNewExam: () => void;
  onViewSubmission: (result: ExamResult) => void;
  onRetakeCombination: (combo: any, year: string, month: string) => void;
  onHomeClick?: () => void;
  inspectedUser?: { id?: string; email: string; displayName?: string } | null;
}

export const MySubmissions: React.FC<MySubmissionsProps> = ({
  initialTab = 'exams',
  onStartNewExam,
  onViewSubmission,
  onRetakeCombination,
  onHomeClick,
  inspectedUser
}) => {
  const { user, isConfigured } = useAuth();
  const { language, t } = useLanguage();

  const [activeTab, setActiveTab] = useState<'exams' | 'mistakes'>(initialTab);
  const [submissions, setSubmissions] = useState<ExamResult[]>([]);
  const [mistakes, setMistakes] = useState<SavedMistake[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'evaluated' | 'pending'>('all');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    async function loadData() {
      setLoading(true);

      // If in Admin Inspection Mode for a candidate
      if (inspectedUser) {
        try {
          const candData = await getCandidateSubmissionsAndMistakes(inspectedUser.email, inspectedUser.id);
          setSubmissions(candData.submissions);
          setMistakes(candData.mistakes);
          setLoading(false);
          return;
        } catch (e) {
          console.error('Error loading candidate submissions:', e);
        }
      }

      const local = getStoredSubmissions();
      setSubmissions(local);

      const localMistakes = getStoredMistakes();
      setMistakes(localMistakes);

      if (user && isConfigured) {
        try {
          const { submissions: dbSubs, error } = await fetchSubmissionsFromSupabase(user.id);
          if (!error && dbSubs && dbSubs.length > 0) {
            const merged = mergeSubmissions(dbSubs, local);
            setSubmissions(merged);
            syncStoredSubmissions(merged);

            const syncedMistakes = mergeMistakesFromSubmissions(localMistakes, merged);
            setMistakes(syncedMistakes);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.error('Error fetching submissions for MySubmissions:', e);
        }
      }

      setLoading(false);
    }

    loadData();
  }, [user, isConfigured, inspectedUser]);

  const handleDeleteSubmission = async (sub: ExamResult) => {
    if (!sub.id) return;
    const comboNum = sub.combination?.combinationNumber || sub.combination?.combination;
    const confirmed = window.confirm(
      language === 'en'
        ? `Are you sure you want to delete this submission (${sub.month} ${sub.year} — Combination ${comboNum})?`
        : `Voulez-vous vraiment supprimer cette soumission (${sub.month} ${sub.year} — Combinaison ${comboNum}) ?`
    );
    if (!confirmed) return;

    deleteStoredSubmission(sub.id);

    if (user && isConfigured) {
      try {
        await deleteSubmissionFromSupabase(sub.id, user.id);
      } catch (err) {
        console.error('Erreur lors de la suppression sur Supabase:', err);
      }
    }

    setSubmissions((prev) => prev.filter((item) => item.id !== sub.id));
  };

  // Filtered submissions based on search and status
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      const comboNum = String(sub.combination?.combinationNumber || sub.combination?.combination || '');
      const matchSearch =
        searchQuery === '' ||
        comboNum.includes(searchQuery) ||
        (sub.month && sub.month.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (sub.year && sub.year.includes(searchQuery)) ||
        (sub.date && sub.date.toLowerCase().includes(searchQuery.toLowerCase()));

      const hasEval = !!sub.aiEvaluation;
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'evaluated' && hasEval) ||
        (statusFilter === 'pending' && !hasEval);

      return matchSearch && matchStatus;
    });
  }, [submissions, searchQuery, statusFilter]);

  const evaluatedCount = submissions.filter((s) => s.aiEvaluation).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-slate-50 text-slate-900 min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0 border border-blue-100 shadow-2xs">
              <ClipboardList className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {language === 'en' ? 'My Submissions' : 'Mes Soumissions'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'en'
                  ? 'Access all your past exams and your categorized mistakes bank'
                  : "Retrouvez l'historique complet de vos examens passés et votre banque d'erreurs"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onStartNewExam}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-2xs cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{language === 'en' ? 'New Exam' : 'Nouvel Examen'}</span>
          </button>
        </div>
      </div>

      {/* Main Tab Navigation: Mes Examens vs Mes Fautes */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('exams')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'exams'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span>{language === 'en' ? 'My Exams' : 'Mes Examens'}</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === 'exams'
                ? 'bg-white text-blue-700'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {submissions.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('mistakes')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'mistakes'
              ? 'bg-purple-600 text-white shadow-2xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{language === 'en' ? 'My Mistakes' : 'Mes Fautes'}</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === 'mistakes'
                ? 'bg-white text-purple-700'
                : 'bg-purple-100 text-purple-800'
            }`}
          >
            {mistakes.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Mes Examens */}
      {activeTab === 'exams' && (
        <div className="space-y-4">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                {language === 'en' ? 'Total Exams' : 'Total Examens'}
              </span>
              <p className="text-2xl font-black text-slate-900 mt-1">{submissions.length}</p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                {language === 'en' ? 'AI Evaluated' : 'Évalués par IA'}
              </span>
              <p className="text-2xl font-black text-emerald-600 mt-1">
                {evaluatedCount} <span className="text-xs font-bold text-slate-400">/ {submissions.length}</span>
              </p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                {language === 'en' ? 'Total Mistakes' : 'Erreurs identifiées'}
              </span>
              <p className="text-2xl font-black text-purple-600 mt-1">{mistakes.length}</p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                {language === 'en' ? 'Completion' : 'Taux d’achèvement'}
              </span>
              <p className="text-2xl font-black text-blue-600 mt-1">
                {submissions.length > 0 ? Math.round((evaluatedCount / submissions.length) * 100) : 0}%
              </p>
            </div>
          </div>

          {/* Table Container */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xs">
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={language === 'en' ? 'Search by combo, month or year...' : 'Rechercher par combo, mois, année...'}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-medium"
                />
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <span className="text-xs font-semibold text-slate-500 mr-1 hidden sm:inline">
                  {language === 'en' ? 'Status:' : 'Statut :'}
                </span>
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {language === 'en' ? 'All' : 'Tous'} ({submissions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('evaluated')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    statusFilter === 'evaluated'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  {language === 'en' ? 'Evaluated' : 'Évalués'} ({evaluatedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('pending')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    statusFilter === 'pending'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  {language === 'en' ? 'Pending' : 'En attente'} ({submissions.length - evaluatedCount})
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-slate-500 text-sm font-medium">
                {language === 'en' ? 'Loading your submissions...' : 'Chargement de vos soumissions...'}
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="text-center py-12 text-slate-500 bg-slate-50/60 border border-slate-200 rounded-xl p-8">
                <p className="text-sm font-semibold text-slate-700 mb-2">
                  {searchQuery || statusFilter !== 'all'
                    ? language === 'en'
                      ? 'No submissions match your filter.'
                      : 'Aucune soumission ne correspond à votre filtre.'
                    : language === 'en'
                    ? 'No submissions yet.'
                    : 'Aucun examen enregistré pour le moment.'}
                </p>
                <p className="text-xs text-slate-500 mb-4 max-w-md mx-auto">
                  {language === 'en'
                    ? 'Practice in official TCF Canada conditions (60 minutes for 3 written tasks).'
                    : 'Entraînez-vous dans les conditions réelles du TCF Canada (60 minutes pour 3 tâches rédigées).'}
                </p>
                <button
                  type="button"
                  onClick={onStartNewExam}
                  className="inline-block px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  {language === 'en' ? 'Start your first exam' : 'Passer votre premier examen'}
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase font-bold text-slate-500 bg-slate-50/80">
                      <th className="py-3 px-3.5">{t('Date')}</th>
                      <th className="py-3 px-3.5 whitespace-nowrap">{t('Série / Combinaison')}</th>
                      <th className="py-3 px-3.5">{t('Tâche 1')}</th>
                      <th className="py-3 px-3.5">{t('Tâche 2')}</th>
                      <th className="py-3 px-3.5">{t('Tâche 3')}</th>
                      <th className="py-3 px-3.5 whitespace-nowrap">{t('Score IA')}</th>
                      <th className="py-3 px-3.5 text-left whitespace-nowrap">{t('Actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredSubmissions.map((sub) => {
                      const comboNum = sub.combination?.combinationNumber || sub.combination?.combination || 1;
                      const isPract = !!sub.isPracticeMode && (!!sub.practiceTasks || !!sub.practiceTask);

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

                      const dateParts = sub.date ? sub.date.split(/(?: à |[ ,]+)/) : [];
                      const dPart = dateParts[0] || sub.date || '—';
                      const tPart = dateParts.length >= 2 ? dateParts[1] : '';

                      return (
                        <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-3.5 font-medium text-slate-800 text-xs whitespace-nowrap">
                            <div className="flex flex-col leading-tight">
                              <span className="font-semibold text-slate-900">{dPart}</span>
                              {tPart && (
                                <span className="text-[11px] text-slate-500 font-mono mt-0.5">
                                  {tPart}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-3.5 font-medium text-slate-800 whitespace-nowrap">
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
                          <td className="py-3.5 px-3.5">
                            {isPract && !activeTasksList.includes('task1') ? (
                              <span className="text-slate-400 text-xs font-mono">—</span>
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded font-mono text-xs font-bold border inline-block ${
                                  t1Ok
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                    : 'bg-red-50 text-red-600 border-red-300'
                                }`}
                              >
                                {sub.wordCounts.task1} {t('mots')}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3.5">
                            {isPract && !activeTasksList.includes('task2') ? (
                              <span className="text-slate-400 text-xs font-mono">—</span>
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded font-mono text-xs font-bold border inline-block ${
                                  t2Ok
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                    : 'bg-red-50 text-red-600 border-red-300'
                                }`}
                              >
                                {sub.wordCounts.task2} {t('mots')}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3.5">
                            {isPract && !activeTasksList.includes('task3') ? (
                              <span className="text-slate-400 text-xs font-mono">—</span>
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded font-mono text-xs font-bold border inline-block ${
                                  t3Ok
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                    : 'bg-red-50 text-red-600 border-red-300'
                                }`}
                              >
                                {sub.wordCounts.task3} {t('mots')}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3.5 whitespace-nowrap">
                            {sub.aiEvaluation ? (
                              (() => {
                                const evaluatedCountTask = sub.aiEvaluation.evaluated_tasks?.length || (isPract ? activeTasksList.length : 3);
                                const isSingle = evaluatedCountTask === 1;
                                const lvl = sub.aiEvaluation.estimated_cefr_level;
                                const clb = sub.aiEvaluation.clb_level;
                                const displayLevel = clb && lvl ? `${clb} (${lvl})` : (clb || lvl);

                                if (isSingle) {
                                  return lvl ? (
                                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                      {displayLevel}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-slate-500 font-medium">—</span>
                                  );
                                }

                                const score = sub.aiEvaluation.overall_score;
                                return typeof score === 'number' ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-extrabold text-slate-800 font-mono text-sm">
                                      {Math.round(score)}/20
                                    </span>
                                    {lvl && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                                        {displayLevel}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-500 font-medium">—</span>
                                );
                              })()
                            ) : (
                              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
                                {language === 'en' ? 'Pending' : 'Non évalué'}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3.5 whitespace-nowrap text-left">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onViewSubmission(sub)}
                                className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                                title={t('Consulter la correction')}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>{t('Consulter')}</span>
                              </button>

                              {sub.combination && (
                                <button
                                  type="button"
                                  onClick={() => onRetakeCombination(sub.combination, sub.year, sub.month)}
                                  className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 font-semibold text-xs transition-colors flex items-center justify-center cursor-pointer"
                                  title={language === 'en' ? 'Retake combination' : 'Recommencer'}
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleDeleteSubmission(sub)}
                                className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-semibold text-xs transition-colors flex items-center justify-center cursor-pointer"
                                title={t('Supprimer la soumission')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
        </div>
      )}

      {/* Tab 2: Mes Fautes */}
      {activeTab === 'mistakes' && (
        <div className="space-y-4">
          <MistakesView
            mistakes={mistakes}
            onMistakesChange={setMistakes}
            onStartExam={onStartNewExam}
            onGoToExams={() => setActiveTab('exams')}
          />
        </div>
      )}
    </div>
  );
};
