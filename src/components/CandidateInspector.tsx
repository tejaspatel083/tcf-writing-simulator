import React, { useState, useEffect, useMemo } from 'react';
import { CandidateProfile, getCandidateSubmissionsAndMistakes, evaluateAndSaveCandidateSubmission, extractMistakesFromSubmissions } from '../services/userProfilesService';
import { ExamResult } from '../types/exam';
import { SavedMistake, CefrLevel } from '../types/aiEvaluation';
import { DashboardBentoLayout } from './DashboardBentoLayout';
import { DashboardAnalytics } from './DashboardAnalytics';
import { MistakesView } from './MistakesView';
import { mapScoreToTcfCanadaLevels } from '../services/geminiEvaluator';
import { useLanguage } from '../context/LanguageContext';
import {
  ArrowLeft,
  User,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  AlertCircle,
  BarChart3,
  BookOpen,
  Sparkles,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Flame,
  X
} from 'lucide-react';

interface CandidateInspectorProps {
  candidate: CandidateProfile;
  onBack: () => void;
  onImpersonate: (candidate: CandidateProfile) => void;
  onViewSubmission: (sub: ExamResult) => void;
}

export const CandidateInspector: React.FC<CandidateInspectorProps> = ({
  candidate,
  onBack,
  onImpersonate,
  onViewSubmission
}) => {
  const { language, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'submissions' | 'mistakes'>('dashboard');
  const [submissions, setSubmissions] = useState<ExamResult[]>([]);
  const [mistakes, setMistakes] = useState<SavedMistake[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [calendarDate, setCalendarDate] = useState<Date>(() => new Date());

  // Selected submission modal for direct deep inspection
  const [inspectedSubmission, setInspectedSubmission] = useState<ExamResult | null>(null);

  // Evaluation state
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [batchEvaluating, setBatchEvaluating] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  const handleEvaluateSingle = async (sub: ExamResult) => {
    if (!sub.id) return;
    setEvaluatingId(sub.id);
    setEvalError(null);
    try {
      const evalData = await evaluateAndSaveCandidateSubmission(sub);
      const updatedSub: ExamResult = { ...sub, aiEvaluation: evalData };
      setSubmissions((prev) => {
        const next = prev.map((s) => (s.id === sub.id ? updatedSub : s));
        setMistakes(extractMistakesFromSubmissions(next));
        return next;
      });
      if (inspectedSubmission && inspectedSubmission.id === sub.id) {
        setInspectedSubmission(updatedSub);
      }
    } catch (err: any) {
      console.error('Error evaluating submission:', err);
      setEvalError(err?.message || "Erreur lors de l'évaluation");
    } finally {
      setEvaluatingId(null);
    }
  };

  const handleBatchEvaluate = async () => {
    const unevaluated = submissions.filter(
      (s) =>
        !s.aiEvaluation &&
        (s.answers.task1?.trim() || s.answers.task2?.trim() || s.answers.task3?.trim())
    );
    if (unevaluated.length === 0) return;

    setBatchEvaluating(true);
    setEvalError(null);
    try {
      for (let i = 0; i < unevaluated.length; i++) {
        const sub = unevaluated[i];
        setBatchProgress(`${i + 1}/${unevaluated.length}...`);
        try {
          const evalData = await evaluateAndSaveCandidateSubmission(sub);
          const updatedSub = { ...sub, aiEvaluation: evalData };
          setSubmissions((prev) => {
            const next = prev.map((s) => (s.id === sub.id ? updatedSub : s));
            setMistakes(extractMistakesFromSubmissions(next));
            return next;
          });
        } catch (itemErr) {
          console.warn(`Failed evaluating sub ${sub.id}:`, itemErr);
        }
      }
    } finally {
      setBatchEvaluating(false);
      setBatchProgress(null);
    }
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const data = await getCandidateSubmissionsAndMistakes(candidate.email, candidate.id);
      setSubmissions(data.submissions);
      setMistakes(data.mistakes);
      setLoading(false);
    }
    loadData();
  }, [candidate]);

  // Performance stats for Bento layout
  const perfStats = useMemo(() => {
    const scores = submissions.map((s) => s.aiEvaluation?.overall_score || 0).filter((s) => s > 0);
    if (scores.length === 0) {
      return {
        avgScore: 0,
        avgCefr: '—' as const,
        bestScore: 0,
        bestCefr: '—' as const
      };
    }
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / scores.length);
    const best = Math.max(...scores);
    return {
      avgScore: avg,
      avgCefr: mapScoreToTcfCanadaLevels(avg).cefr,
      bestScore: best,
      bestCefr: mapScoreToTcfCanadaLevels(best).cefr
    };
  }, [submissions]);

  // Practiced date set for Calendar
  const practicedDateSet = useMemo(() => {
    const set = new Set<string>();
    submissions.forEach((s) => {
      if (!s.date) return;
      const clean = s.date.split(/(?: à |[ ,T]+)/)[0].trim();
      const dmy = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmy) {
        const y = dmy[3];
        const m = dmy[2].padStart(2, '0');
        const d = dmy[1].padStart(2, '0');
        set.add(`${y}-${m}-${d}`);
        return;
      }
      const ymd = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
      if (ymd) {
        const y = ymd[1];
        const m = ymd[2].padStart(2, '0');
        const d = ymd[3].padStart(2, '0');
        set.add(`${y}-${m}-${d}`);
      }
    });
    return set;
  }, [submissions]);

  // Calendar grid
  const calendarGrid = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const days: Array<{
      day: number | null;
      key: string;
      isPracticed: boolean;
      isToday: boolean;
    }> = [];

    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ day: null, key: `empty-${i}`, isPracticed: false, isToday: false });
    }

    let practicedInMonth = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dayKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isPracticed = practicedDateSet.has(dayKey);
      if (isPracticed) practicedInMonth++;
      days.push({
        day: d,
        key: dayKey,
        isPracticed,
        isToday: dayKey === todayKey
      });
    }

    const monthLabel = calendarDate.toLocaleDateString(language === 'en' ? 'en-US' : 'fr-FR', {
      month: 'long',
      year: 'numeric'
    });

    return {
      year,
      month,
      days,
      practicedInMonth,
      monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)
    };
  }, [calendarDate, practicedDateSet, language]);

  const weekDays = language === 'en'
    ? ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
    : ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

  return (
    <div className="space-y-6">
      {/* Top Back Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/60">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#e8edf5] border border-white/80 shadow-[3px_3px_8px_#c2cee0,-3px_-3px_8px_#ffffff] text-slate-700 hover:text-blue-600 text-xs font-bold transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('Retour à la liste des candidats')}</span>
        </button>

        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {t('Mode Administrateur')}
          </span>
          <button
            type="button"
            onClick={() => onImpersonate(candidate)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{t('Aperçu direct dans l\'app')}</span>
          </button>
        </div>
      </div>

      {/* Candidate Profile Summary Header Card (3D Neumorphism) */}
      <div className="rounded-[28px] bg-[#e8edf5] border border-white/85 shadow-[8px_8px_20px_#c2cee0,-8px_-8px_20px_#ffffff] p-6 sm:p-7">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Identity info */}
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 text-white flex items-center justify-center font-black text-2xl shadow-md shrink-0 border border-white/30">
              {candidate.email.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight truncate">
                  {candidate.displayName}
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                  <User className="w-3 h-3" />
                  {t('Candidat TCF')}
                </span>
                {candidate.isMonitored && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    {t('Alertes actives')}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1 truncate">
                {candidate.email}
              </p>
              <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                <span>{t('Inscrit le')} {new Date(candidate.createdAt).toLocaleDateString()}</span>
                <span>•</span>
                <span>{t('Dernière session :')} {candidate.lastActiveDate || '—'}</span>
              </div>
            </div>
          </div>

          {/* 4 Stat Badges (3D Inset Wells) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full md:w-auto">
            <div className="px-3.5 py-2.5 rounded-2xl bg-[#e8edf5] border border-white/60 shadow-[inset_2px_2px_5px_#c2cee0,inset_-2px_-2px_5px_#ffffff] text-center">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('Note Moy.')}</span>
              <span className="text-base font-black text-blue-700">{perfStats.avgScore > 0 ? `${perfStats.avgScore}/20` : '—'}</span>
              <span className="block text-[10px] font-extrabold text-blue-600">{perfStats.avgCefr}</span>
            </div>

            <div className="px-3.5 py-2.5 rounded-2xl bg-[#e8edf5] border border-white/60 shadow-[inset_2px_2px_5px_#c2cee0,inset_-2px_-2px_5px_#ffffff] text-center">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('Meilleure')}</span>
              <span className="text-base font-black text-emerald-700">{perfStats.bestScore > 0 ? `${perfStats.bestScore}/20` : '—'}</span>
              <span className="block text-[10px] font-extrabold text-emerald-600">{perfStats.bestCefr}</span>
            </div>

            <div className="px-3.5 py-2.5 rounded-2xl bg-[#e8edf5] border border-white/60 shadow-[inset_2px_2px_5px_#c2cee0,inset_-2px_-2px_5px_#ffffff] text-center">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('Devoirs')}</span>
              <span className="text-base font-black text-slate-800">{submissions.length}</span>
              <span className="block text-[10px] font-semibold text-slate-400">{t('sessions')}</span>
            </div>

            <div className="px-3.5 py-2.5 rounded-2xl bg-[#e8edf5] border border-white/60 shadow-[inset_2px_2px_5px_#c2cee0,inset_-2px_-2px_5px_#ffffff] text-center">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('Fautes')}</span>
              <span className="text-base font-black text-amber-600">{mistakes.length}</span>
              <span className="block text-[10px] font-semibold text-slate-400">{t('identifiées')}</span>
            </div>
          </div>
        </div>

        {/* 3 Interactive Section Tabs (Same as user sees!) */}
        <div className="mt-6 pt-5 border-t border-slate-200/50 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white shadow-[inset_1px_1px_3px_rgba(0,0,0,0.2)]'
                : 'bg-[#e8edf5] text-slate-600 hover:text-slate-900 border border-white/80 shadow-[3px_3px_8px_#c2cee0,-3px_-3px_8px_#ffffff]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>{t('Tableau de bord & Analyses (Bento)')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('submissions')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'submissions'
                ? 'bg-blue-600 text-white shadow-[inset_1px_1px_3px_rgba(0,0,0,0.2)]'
                : 'bg-[#e8edf5] text-slate-600 hover:text-slate-900 border border-white/80 shadow-[3px_3px_8px_#c2cee0,-3px_-3px_8px_#ffffff]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{t('Devoirs Soumis')}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'submissions' ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {submissions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mistakes')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'mistakes'
                ? 'bg-blue-600 text-white shadow-[inset_1px_1px_3px_rgba(0,0,0,0.2)]'
                : 'bg-[#e8edf5] text-slate-600 hover:text-slate-900 border border-white/80 shadow-[3px_3px_8px_#c2cee0,-3px_-3px_8px_#ffffff]'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{t('Banque de Fautes')}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'mistakes' ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {mistakes.length}
            </span>
          </button>

          {/* Batch Evaluation Button */}
          {submissions.some((s) => !s.aiEvaluation && (s.answers.task1?.trim() || s.answers.task2?.trim() || s.answers.task3?.trim())) && (
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={handleBatchEvaluate}
                disabled={batchEvaluating}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-[2px_2px_8px_rgba(147,51,234,0.35)] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className={`w-3.5 h-3.5 ${batchEvaluating ? 'animate-spin' : ''}`} />
                <span>
                  {batchProgress
                    ? `${t('Évaluation en cours')} (${batchProgress})`
                    : `${t('⚡ Évaluer les devoirs en attente')} (${submissions.filter((s) => !s.aiEvaluation && (s.answers.task1?.trim() || s.answers.task2?.trim() || s.answers.task3?.trim())).length})`}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {evalError && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center justify-between">
          <span>⚠️ {evalError}</span>
          <button type="button" onClick={() => setEvalError(null)} className="font-bold underline ml-2 cursor-pointer">
            OK
          </button>
        </div>
      )}

      {/* Main Content Area based on Active Tab */}
      {loading ? (
        <div className="py-12 text-center text-slate-500 text-xs font-medium">
          {t('Chargement du profil et des devoirs...')}
        </div>
      ) : (
        <div>
          {/* TAB 1: DASHBOARD BENTO & ANALYTICS */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <DashboardBentoLayout
                userName={candidate.displayName}
                submissions={submissions}
                mistakes={mistakes}
                targetGoal={candidate.targetGoal || 'B2'}
                perfStats={perfStats}
                calendarGrid={calendarGrid}
                weekDays={weekDays}
                handlePrevMonth={(e) => {
                  e.stopPropagation();
                  setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
                }}
                handleNextMonth={(e) => {
                  e.stopPropagation();
                  setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
                }}
                onStartNewExam={() => {}}
                onViewSubmission={(sub) => setInspectedSubmission(sub)}
                onSwitchTab={(tab) => {
                  if (tab === 'mistakes') setActiveTab('mistakes');
                  if (tab === 'submissions') setActiveTab('submissions');
                }}
              />

              {/* Neomorphic 3D Analytics Area Chart & Spider Radar */}
              <DashboardAnalytics
                submissions={submissions}
                mistakes={mistakes}
                onStartNewExam={() => {}}
                onViewSubmission={(sub) => setInspectedSubmission(sub)}
              />
            </div>
          )}

          {/* TAB 2: SUBMISSIONS LIST WITH DETAIL DRAWER/MODAL */}
          {activeTab === 'submissions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  {t('Historique des Devoirs et Évaluations IA')} ({submissions.length})
                </h3>
              </div>

              {submissions.length === 0 ? (
                <div className="p-12 text-center rounded-3xl bg-[#e8edf5] border border-white/80 shadow-[inset_2px_2px_6px_#c2cee0,inset_-2px_-2px_6px_#ffffff] text-slate-500 text-xs space-y-2">
                  <span className="text-2xl block">📂</span>
                  <p className="font-bold text-slate-700 text-sm">{t('Aucun devoir soumis sur Supabase')}</p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                    {t('Ce candidat est bien enregistré dans la base Supabase, mais n\'a pas encore terminé ou soumis de session d\'examen écrite.')}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3.5">
                  {submissions.map((sub, idx) => {
                    const comboNum = sub.combination?.combinationNumber || sub.combination?.combination || idx + 1;
                    const score = sub.aiEvaluation?.overall_score;
                    const cefr = sub.aiEvaluation?.estimated_cefr_level || (score ? mapScoreToTcfCanadaLevels(score).cefr : '—');
                    const clb = sub.aiEvaluation?.clb_level || (score ? mapScoreToTcfCanadaLevels(score).clb : '');

                    return (
                      <div
                        key={sub.id || idx}
                        className="rounded-2xl bg-[#e8edf5] border border-white/80 shadow-[5px_5px_12px_#c2cee0,-5px_-5px_12px_#ffffff] p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-transform hover:-translate-y-0.5"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 font-black text-sm flex items-center justify-center shrink-0 border border-blue-200">
                            #{comboNum}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-800 truncate">
                              {sub.month} {sub.year} — {language === 'en' ? 'Combination' : 'Combinaison'} {comboNum}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                              <span>📅 {sub.date}</span>
                              <span>•</span>
                              <span>⏱️ {Math.round((sub.timeUsedSeconds || 0) / 60)} min</span>
                              <span>•</span>
                              <span>✍️ T1: {sub.wordCounts.task1}{language === 'en' ? 'w' : 'm'} | T2: {sub.wordCounts.task2}{language === 'en' ? 'w' : 'm'} | T3: {sub.wordCounts.task3}{language === 'en' ? 'w' : 'm'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                          {score !== undefined ? (
                            <div className="text-right">
                              <span className="text-base font-black text-slate-900">{score}/20</span>
                              <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                                {cefr} ({clb})
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-400">{t('Non évalué')}</span>
                              {(sub.answers.task1?.trim() || sub.answers.task2?.trim() || sub.answers.task3?.trim()) && (
                                <button
                                  type="button"
                                  onClick={() => handleEvaluateSingle(sub)}
                                  disabled={evaluatingId === sub.id}
                                  className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                >
                                  <Sparkles className={`w-3 h-3 ${evaluatingId === sub.id ? 'animate-spin' : ''}`} />
                                  <span>{evaluatingId === sub.id ? '...' : t('Évaluer')}</span>
                                </button>
                              )}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => setInspectedSubmission(sub)}
                            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{t('Consulter')}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MISTAKES BANK */}
          {activeTab === 'mistakes' && (
            <div className="space-y-4">
              {mistakes.length === 0 ? (
                <div className="p-12 text-center rounded-3xl bg-[#e8edf5] border border-white/80 shadow-[inset_2px_2px_6px_#c2cee0,inset_-2px_-2px_6px_#ffffff] text-slate-500 text-xs space-y-2">
                  <span className="text-2xl block">✨</span>
                  <p className="font-bold text-slate-700 text-sm">{t('Aucune faute répertoriée')}</p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                    {t('Ce candidat n\'a aucune faute enregistrée. Les erreurs de grammaire, orthographe et syntaxe s\'afficheront ici automatiquement dès que des devoirs auront été soumis et évalués par l\'IA.')}
                  </p>
                </div>
              ) : (
                <MistakesView
                  mistakes={mistakes}
                  onMistakesChange={setMistakes}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* FULL EXAM EVALUATION DETAILS MODAL */}
      {inspectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-[#e8edf5] border-b border-slate-200/80 text-slate-800 flex items-center justify-between shadow-2xs">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-slate-900">
                    {inspectedSubmission.month} {inspectedSubmission.year} — {language === 'en' ? 'Combination' : 'Combinaison'} {inspectedSubmission.combination?.combinationNumber || inspectedSubmission.combination?.combination}
                  </h3>
                  {inspectedSubmission.aiEvaluation?.overall_score && (
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white font-black text-xs shadow-xs">
                      {inspectedSubmission.aiEvaluation.overall_score}/20 • {inspectedSubmission.aiEvaluation.estimated_cefr_level}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  {t('Candidat :')} <span className="text-slate-800 font-semibold">{candidate.email}</span> • {t('Date :')} {inspectedSubmission.date}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setInspectedSubmission(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Task 1, 2, 3 Breakdown */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
              {!inspectedSubmission.aiEvaluation && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                  <div>
                    <span className="font-bold text-amber-900 block text-xs">⚠️ {t('Devoir non encore évalué par l\'IA')}</span>
                    <span className="text-[11px] text-amber-700">
                      {t('Lancez l\'évaluation TCF Canada officielle pour générer la note, le niveau CECRL et sauvegarder les résultats dans Supabase.')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleEvaluateSingle(inspectedSubmission)}
                    disabled={evaluatingId === inspectedSubmission.id}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${evaluatingId === inspectedSubmission.id ? 'animate-spin' : ''}`} />
                    <span>{evaluatingId === inspectedSubmission.id ? t('Évaluation en cours...') : t('Évaluer ce devoir avec l\'IA')}</span>
                  </button>
                </div>
              )}

              {inspectedSubmission.aiEvaluation?.overall_feedback && (
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-950 leading-relaxed">
                  <span className="font-bold block mb-1">📢 {t('Synthèse Générale de l\'IA')} :</span>
                  {inspectedSubmission.aiEvaluation.overall_feedback}
                </div>
              )}

              {/* Tasks 1, 2, 3 */}
              {(['task1', 'task2', 'task3'] as const).map((tKey, tIdx) => {
                const answer = inspectedSubmission.answers[tKey];
                const wordCount = inspectedSubmission.wordCounts[tKey];
                const tEval = inspectedSubmission.aiEvaluation?.tasks[tKey];
                const taskLabel = tIdx === 0 ? t('Tâche 1 : Message amical') : tIdx === 1 ? t('Tâche 2 : Récit d’expérience') : t('Tâche 3 : Essai argumentatif');

                return (
                  <div key={tKey} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-800">{taskLabel}</span>
                        <span className="text-xs text-slate-500 font-medium">({wordCount} {language === 'en' ? 'words' : 'mots'})</span>
                      </div>
                      {tEval && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-slate-900">{tEval.score}/20</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
                            {tEval.estimated_level}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Candidate's written answer */}
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        {t('Texte rédigé par le candidat')} :
                      </span>
                      <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed shadow-2xs">
                        {answer || (language === 'en' ? '— Not written —' : '— Non rédigé —')}
                      </div>
                    </div>

                    {/* AI Feedback on this task */}
                    {tEval && (
                      <div className="space-y-2 pt-1">
                        {tEval.general_feedback && (
                          <div className="text-xs text-slate-600 bg-emerald-50/60 border border-emerald-200/60 rounded-xl p-3">
                            <span className="font-bold text-emerald-900 block mb-0.5">✓ {t('Commentaire pédagogique')} :</span>
                            {tEval.general_feedback}
                          </div>
                        )}

                        {tEval.mistakes && tEval.mistakes.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                              {t('Fautes identifiées')} ({tEval.mistakes.length}) :
                            </span>
                            {tEval.mistakes.map((m, mIdx) => (
                              <div key={mIdx} className="p-2.5 rounded-lg bg-red-50/60 border border-red-200 text-xs space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                                    {m.category}
                                  </span>
                                  <span className="line-through text-red-700 font-semibold">{m.original_text}</span>
                                  <span className="text-slate-400">→</span>
                                  <span className="text-emerald-700 font-bold">{m.corrected_text}</span>
                                </div>
                                {m.explanation && (
                                  <div className="text-[11px] text-slate-600 italic pl-1">
                                    💡 {m.explanation}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#e8edf5] border-t border-slate-200/80 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectedSubmission(null)}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {t('Fermer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
