import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchSubmissionsFromSupabase, deleteSubmissionFromSupabase } from '../lib/supabase';
import { getStoredSubmissions, deleteStoredSubmission, mergeSubmissions, syncStoredSubmissions } from '../utils/storage';
import { ExamResult, TaskKey } from '../types/exam';
import { SavedMistake, CefrLevel } from '../types/aiEvaluation';
import { AdminPanel } from '../components/AdminPanel';
import { MistakesView } from '../components/MistakesView';
import { DashboardAnalytics } from '../components/DashboardAnalytics';
import { getStoredMistakes, mergeMistakesFromSubmissions } from '../utils/mistakesStorage';
import { useLanguage } from '../context/LanguageContext';
import { mapScoreToTcfCanadaLevels } from '../services/geminiEvaluator';
import {
  BarChart3,
  CheckCircle2,
  Calendar,
  Award,
  Target,
  Trash2,
  Eye,
  TrendingUp,
  BookOpen,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LayoutDashboard,
  Gauge
} from 'lucide-react';

interface DashboardProps {
  onStartNewExam: () => void;
  onViewSubmission: (result: ExamResult) => void;
  onRetakeCombination: (combo: any, year: string, month: string) => void;
  onHomeClick: () => void;
  onFeedbackClick?: () => void;
  initialTab?: 'submissions' | 'mistakes' | 'admin';
  onTabChange?: (tab: 'submissions' | 'mistakes' | 'admin') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onStartNewExam,
  onViewSubmission,
  initialTab,
  onTabChange
}) => {
  const { user, userName, isConfigured, isAdmin } = useAuth();
  const { language, t } = useLanguage();
  const [submissions, setSubmissions] = useState<ExamResult[]>([]);
  const [mistakes, setMistakes] = useState<SavedMistake[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'submissions' | 'mistakes' | 'admin'>(
    initialTab || (isAdmin ? 'admin' : 'submissions')
  );

  const handleSwitchTab = (tab: 'submissions' | 'mistakes' | 'admin') => {
    setActiveTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    } else if (isAdmin) {
      setActiveTab('admin');
    }
  }, [initialTab, isAdmin]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    async function loadData() {
      setLoading(true);
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

  // Compute summary stats
  const totalSubmissions = submissions.length;
  const lastSubmissionDate = submissions[0]?.date ? submissions[0].date.split(' ')[0] : '—';

  // Set of all distinct practice date keys (YYYY-MM-DD)
  const practicedDateSet = useMemo(() => {
    const set = new Set<string>();
    const parseDateToMidnight = (dateStr?: string): Date | null => {
      if (!dateStr || typeof dateStr !== 'string') return null;
      const clean = dateStr.trim();
      if (!clean) return null;

      const datePart = clean.split(/(?: à |[ ,T]+)/)[0].trim();
      const dmy = datePart.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmy) {
        return new Date(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10));
      }

      const ymd = datePart.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
      if (ymd) {
        return new Date(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10));
      }

      const parsed = new Date(clean);
      return isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    };

    submissions.forEach((s) => {
      const d = parseDateToMidnight(s.date);
      if (d) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        set.add(key);
      }
    });

    return set;
  }, [submissions]);

  // Big Practice Calendar State (Combined 2nd & 3rd cards in the middle)
  const [calendarDate, setCalendarDate] = useState<Date>(() => new Date());

  const calendarGrid = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    // Monday = 0, Sunday = 6
    const startDayIndex = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const days: Array<{
      day: number | null;
      key: string;
      isPracticed: boolean;
      isToday: boolean;
    }> = [];

    for (let i = 0; i < startDayIndex; i++) {
      days.push({ day: null, key: `empty-${i}`, isPracticed: false, isToday: false });
    }

    let practicedInMonth = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isPracticed = practicedDateSet.has(key);
      if (isPracticed) practicedInMonth++;
      days.push({
        day: d,
        key,
        isPracticed,
        isToday: key === todayKey
      });
    }

    // Pad to fixed 42 cells (exactly 6 rows of 7 days) so month switching never changes layout size
    const totalCells = 42;
    while (days.length < totalCells) {
      days.push({
        day: null,
        key: `empty-tail-${days.length}`,
        isPracticed: false,
        isToday: false
      });
    }

    return {
      year,
      month,
      days,
      practicedInMonth,
      monthLabel: calendarDate.toLocaleDateString(language === 'en' ? 'en-US' : 'fr-FR', {
        month: 'long',
        year: 'numeric'
      })
    };
  }, [calendarDate, practicedDateSet, language]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const weekDays = useMemo(() => {
    return language === 'en'
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  }, [language]);

  // Collapsible Overview Accordion State (saved in localStorage like mistakes subtopics)
  const [isOverviewOpen, setIsOverviewOpen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('tcf_dashboard_overview_open');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleOverview = () => {
    setIsOverviewOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('tcf_dashboard_overview_open', String(next));
      } catch {}
      return next;
    });
  };

  // Target Goal State (synced with localStorage key used in DashboardAnalytics)
  const [targetGoal, setTargetGoal] = useState<CefrLevel>(() => {
    try {
      const stored = localStorage.getItem('tcf_user_target_goal_v1');
      if (stored && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(stored)) {
        return stored as CefrLevel;
      }
    } catch {}
    return 'B2';
  });

  useEffect(() => {
    const syncGoal = () => {
      try {
        const stored = localStorage.getItem('tcf_user_target_goal_v1');
        if (stored && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(stored)) {
          setTargetGoal(stored as CefrLevel);
        }
      } catch {}
    };
    window.addEventListener('storage', syncGoal);
    window.addEventListener('tcf_target_goal_updated', syncGoal);
    return () => {
      window.removeEventListener('storage', syncGoal);
      window.removeEventListener('tcf_target_goal_updated', syncGoal);
    };
  }, []);

  // Performance Stats from evaluated submissions (Integer scores, average & best)
  const perfStats = useMemo(() => {
    const scores = submissions
      .filter((s) => s.aiEvaluation && typeof s.aiEvaluation.overall_score === 'number')
      .map((s) => Math.max(0, Math.min(20, Math.round(s.aiEvaluation!.overall_score))));

    if (scores.length === 0) {
      return {
        avgScore: 0,
        avgCefr: '—' as CefrLevel | '—',
        bestScore: 0,
        bestCefr: '—' as CefrLevel | '—'
      };
    }

    const sum = scores.reduce((a, b) => a + b, 0);
    const avgScore = Math.round(sum / scores.length);
    const bestScore = Math.max(...scores);

    return {
      avgScore,
      avgCefr: mapScoreToTcfCanadaLevels(avgScore).cefr,
      bestScore,
      bestCefr: mapScoreToTcfCanadaLevels(bestScore).cefr
    };
  }, [submissions]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-slate-50 text-slate-900">
      {/* Collapsible Overview Section (Accordion styling matching Mistakes Bank subtopics) */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs transition-shadow hover:shadow-sm">
        {/* Accordion Header (Click to expand/collapse 3 cards) */}
        <button
          type="button"
          onClick={toggleOverview}
          className={`w-full p-3.5 sm:p-4 flex items-center justify-between text-left transition-colors cursor-pointer ${
            isOverviewOpen ? 'bg-slate-50/80 border-b border-slate-200' : 'hover:bg-slate-50/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0 border border-blue-100 shadow-2xs">
              <LayoutDashboard className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  {language === 'en' ? 'Overview' : "Vue d'ensemble"}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-blue-50 text-blue-700 border-blue-200/70">
                  {totalSubmissions} {language === 'en' ? (totalSubmissions > 1 ? 'exams' : 'exam') : (totalSubmissions > 1 ? 'examens' : 'examen')} • {perfStats.avgScore > 0 ? `${perfStats.avgScore}/20 (${perfStats.avgCefr})` : `Cible: ${targetGoal}`}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 hidden sm:block">
                {language === 'en'
                  ? 'Key metrics, activity calendar, and CEFR target score'
                  : 'Statistiques clés, calendrier de pratique et objectif de score'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline-block">
              {isOverviewOpen ? (language === 'en' ? 'Hide overview' : 'Masquer') : (language === 'en' ? 'Show overview' : 'Afficher')}
            </span>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200/60 transition-colors">
              {isOverviewOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </div>
          </div>
        </button>

        {/* Collapsible Overview Body (3 Cards with generous margin and large calendar) */}
        {isOverviewOpen && (
          <div className="p-3.5 sm:p-4 bg-slate-50/40">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Card 1: Submitted Exams (1 Col) */}
              <div className="col-span-2 sm:col-span-1 lg:col-span-1 p-4 rounded-xl border border-slate-200 bg-white shadow-2xs flex flex-col justify-between min-h-[350px] sm:h-[355px]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <h3 className="font-bold text-[10px] sm:text-[11px] text-slate-400 uppercase tracking-wider truncate">
                      {t('Examens Soumis')}
                    </h3>
                  </div>
                  <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200/60 shrink-0">
                    <TrendingUp className="w-3 h-3 text-emerald-500" />
                    <span>{t('Actif')}</span>
                  </span>
                </div>

                <div className="my-auto space-y-4">
                  <div className="flex items-baseline justify-between">
                    <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-none">
                      {totalSubmissions}
                    </p>
                    <span className="text-xs font-bold text-slate-500">
                      {submissions.filter((s) => s.aiEvaluation).length} / {totalSubmissions} {t('évalués')}
                    </span>
                  </div>

                  {/* Progress Bar of Evaluated Exams */}
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          totalSubmissions > 0
                            ? (submissions.filter((s) => s.aiEvaluation).length / totalSubmissions) * 100
                            : 0
                        }%`
                      }}
                    />
                  </div>

                  {/* Last Session Box */}
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-500 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        {t('Dernière Session')}
                      </span>
                      <span className="font-bold text-slate-800">{lastSubmissionDate}</span>
                    </div>
                    {submissions[0] && (
                      <p className="text-[11px] text-slate-500 truncate">
                        {t('Combo')} #{submissions[0].combination?.combinationNumber || submissions[0].combination?.combination || 1}
                      </p>
                    )}
                  </div>
                </div>

                <p className="text-[10px] text-emerald-600 font-semibold truncate pt-3 border-t border-slate-100 flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                  <span className="truncate">
                    {submissions.length > 0 ? t('Enregistrés sur votre compte') : t('Aucune soumission')}
                  </span>
                </p>
              </div>

              {/* Card 2: Big Practice Calendar in Middle (Spans 2 Columns, Fixed 6-Week 42-Cell Height) */}
              <div className="col-span-2 sm:col-span-2 lg:col-span-2 p-4 sm:p-5 rounded-xl border border-slate-200 bg-white shadow-2xs flex flex-col justify-between min-h-[350px] sm:h-[355px]">
                {/* Header with Title & Month Switcher with Clear Bottom Margin */}
                <div className="flex items-center justify-between pb-3 sm:pb-3.5 border-b border-slate-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                      <Calendar className="w-4 h-4 text-emerald-600" />
                    </div>
                    <h3 className="font-bold text-[11px] sm:text-xs text-slate-500 uppercase tracking-wider truncate">
                      {language === 'en' ? 'Practice Calendar' : 'Calendrier de Pratique'}
                    </h3>
                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/70 shrink-0">
                      <span>✓ {calendarGrid.practicedInMonth}</span>
                      <span>{calendarGrid.practicedInMonth > 1 ? (language === 'en' ? 'sessions' : 'séances') : (language === 'en' ? 'session' : 'séance')}</span>
                    </span>
                  </div>

                  {/* Interactive Month Switcher - Fixed Stable Width & Fixed Button Positions */}
                  <div className="flex items-center justify-between w-[160px] sm:w-[175px] bg-slate-100/90 p-0.5 rounded-lg border border-slate-200/60 shrink-0">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="w-6 h-6 flex items-center justify-center hover:bg-white rounded-md text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
                      title={language === 'en' ? 'Previous month' : 'Mois précédent'}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="flex-1 text-center text-xs font-black text-slate-700 capitalize px-1 select-none truncate">
                      {calendarGrid.monthLabel}
                    </span>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="w-6 h-6 flex items-center justify-center hover:bg-white rounded-md text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
                      title={language === 'en' ? 'Next month' : 'Mois suivant'}
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Calendar Body: Weekday Row + Fixed 6-Row Day Numbers with generous vertical margins */}
                <div className="my-auto space-y-2">
                  {/* Weekday Row with comfortable vertical margins */}
                  <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center font-bold text-[11px] text-slate-400 uppercase tracking-wider pt-1.5 pb-2 border-b border-slate-100">
                    {weekDays.map((wd) => (
                      <div key={wd} className="truncate">
                        {wd}
                      </div>
                    ))}
                  </div>

                  {/* Days Grid (Always fixed 6 rows of 7 days = 42 cells, size never changes between months) */}
                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                    {calendarGrid.days.map((item) => {
                      if (item.day === null) {
                        return <div key={item.key} className="h-7 sm:h-7.5 pointer-events-none" />;
                      }
                      return (
                        <div
                          key={item.key}
                          className={`h-7 sm:h-7.5 max-w-[38px] w-full mx-auto rounded-md flex items-center justify-center text-xs sm:text-[13px] font-bold transition-all relative ${
                            item.isPracticed
                              ? 'bg-emerald-600 text-white font-black shadow-xs ring-2 ring-emerald-300 scale-[1.06]'
                              : item.isToday
                              ? 'bg-blue-50 text-blue-700 ring-2 ring-blue-500 font-black'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                          title={
                            item.isPracticed
                              ? (language === 'en' ? `Practiced on ${item.key}` : `Session réalisée le ${item.key}`)
                              : item.isToday
                              ? (language === 'en' ? 'Today' : "Aujourd'hui")
                              : undefined
                          }
                        >
                          <span>{item.day}</span>
                          {item.isPracticed && (
                            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-200 rounded-full ring-1 ring-white" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Legend & Summary */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-3.5">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
                      <span className="font-semibold text-slate-700">{language === 'en' ? 'Practiced' : 'Pratiqué'}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full ring-2 ring-blue-500 bg-blue-50 inline-block"></span>
                      <span className="font-medium text-slate-600">{language === 'en' ? 'Today' : "Aujourd'hui"}</span>
                    </span>
                  </div>
                  <span className="font-bold text-emerald-600">
                    {calendarGrid.practicedInMonth > 0
                      ? `${calendarGrid.practicedInMonth} ${
                          language === 'en'
                            ? calendarGrid.practicedInMonth > 1
                              ? 'days active'
                              : 'day active'
                            : calendarGrid.practicedInMonth > 1
                            ? 'jours actifs'
                            : 'jour actif'
                        }`
                      : language === 'en'
                      ? 'No session this month'
                      : 'Aucune session ce mois-ci'}
                  </span>
                </div>
              </div>

              {/* Card 3: Average Goal Speedometer (1 Col) */}
              <div className="col-span-2 sm:col-span-1 lg:col-span-1 p-4 rounded-xl border border-slate-200 bg-white shadow-2xs flex flex-col justify-between min-h-[350px] sm:h-[355px]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                      <Gauge className="w-3.5 h-3.5 text-purple-600" />
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
                      {language === 'en' ? 'Average & Goal' : 'Moyenne & Cible'}
                    </span>
                  </div>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 shrink-0">
                    🎯 {targetGoal}
                  </span>
                </div>

                {/* Speedometer Gauge Dial with comfortable spacing */}
                <div className="flex flex-col items-center justify-center my-auto space-y-1">
                  <svg viewBox="0 0 160 82" className="w-full max-w-[160px] overflow-visible">
                    <defs>
                      <linearGradient id="speedoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#84cc16" />
                        <stop offset="50%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#3b82f6" />
                      </linearGradient>
                    </defs>
                    {/* Background Track Arc */}
                    <path
                      d="M 22 72 A 58 58 0 0 1 138 72"
                      fill="none"
                      stroke="#f1f5f9"
                      strokeWidth="11"
                      strokeLinecap="round"
                    />
                    {/* Active Value Arc */}
                    <path
                      d="M 22 72 A 58 58 0 0 1 138 72"
                      fill="none"
                      stroke="url(#speedoGrad)"
                      strokeWidth="11"
                      strokeLinecap="round"
                      strokeDasharray={182.2}
                      strokeDashoffset={182.2 * (1 - Math.min(Math.max(perfStats.avgScore / 20, 0), 1))}
                      className="transition-all duration-700 ease-out"
                    />
                    {/* Needle Pointer */}
                    <line
                      x1="80"
                      y1="72"
                      x2={80 + Math.cos(Math.PI * (1 - Math.min(Math.max(perfStats.avgScore / 20, 0), 1))) * 40}
                      y2={72 - Math.sin(Math.PI * (1 - Math.min(Math.max(perfStats.avgScore / 20, 0), 1))) * 40}
                      stroke="#1e293b"
                      strokeWidth="2.75"
                      strokeLinecap="round"
                      className="transition-all duration-700 ease-out"
                    />
                    {/* Center Pivot Hub */}
                    <circle
                      cx="80"
                      cy="72"
                      r="4.5"
                      fill="#ffffff"
                      stroke="#1e293b"
                      strokeWidth="2.5"
                    />
                  </svg>
                  <div className="flex items-baseline justify-center gap-1 -mt-2">
                    <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none">
                      {perfStats.avgScore}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">/ 20</span>
                    {perfStats.avgScore > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-indigo-600 text-white shadow-2xs">
                        {perfStats.avgCefr}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 font-medium truncate pt-3 border-t border-slate-100 text-center">
                  {perfStats.bestScore > 0
                    ? language === 'en'
                      ? `Best: ${perfStats.bestScore}/20 (${perfStats.bestCefr}) • Goal: ${targetGoal}`
                      : `Meilleur : ${perfStats.bestScore}/20 (${perfStats.bestCefr}) • Cible : ${targetGoal}`
                    : language === 'en'
                    ? `Target goal: ${targetGoal}`
                    : `Objectif cible : ${targetGoal}`}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tab navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => handleSwitchTab('submissions')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'submissions'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <span>📊</span>
          <span>{t('Mes Examens')} ({submissions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchTab('mistakes')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'mistakes'
              ? 'bg-purple-600 text-white shadow-2xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <span>📝</span>
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

        {isAdmin && (
          <button
            type="button"
            onClick={() => handleSwitchTab('admin')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'admin'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>👑</span>
            <span>{t('Gestion des Notifications')}</span>
          </button>
        )}
      </div>

      {/* Main Tab Content */}
      {isAdmin && activeTab === 'admin' ? (
        <AdminPanel />
      ) : activeTab === 'mistakes' ? (
        <MistakesView
          mistakes={mistakes}
          onMistakesChange={setMistakes}
          onStartExam={onStartNewExam}
          onGoToExams={() => setActiveTab('submissions')}
        />
      ) : (
        <div className="space-y-6">
          {/* Performance Analytics & Progress Visualizations */}
          <DashboardAnalytics
            submissions={submissions}
            mistakes={mistakes}
            onStartNewExam={onStartNewExam}
            onViewSubmission={onViewSubmission}
          />

          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 mb-6 gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                <span>{t('Mes examens précédents')}</span>
                <span className="text-xs font-normal text-slate-500">({submissions.length})</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('Consultez le détail de vos rédactions passées et leur nombre de mots.')}
              </p>
            </div>

            <button
              type="button"
              onClick={onStartNewExam}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1.5 self-start sm:self-auto"
            >
              <span>+</span>
              <span>{t('Commencer un examen')}</span>
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-500 text-sm font-medium">
              {t('Chargement de vos soumissions...')}
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-12 text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-8">
              <p className="text-sm font-semibold text-slate-700 mb-2">
                {t('Aucun examen enregistré pour le moment.')}
              </p>
              <p className="text-xs text-slate-500 mb-4 max-w-md mx-auto">
                {t("Entraînez-vous dans les conditions réelles du TCF Canada (60 minutes pour 3 tâches rédigées).")}
              </p>
              <button
                type="button"
                onClick={onStartNewExam}
                className="inline-block px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                {t('Passer votre premier examen')}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase font-bold text-slate-600 bg-slate-50/80">
                    <th className="py-3 px-3.5">{t('Date')}</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">{t('Série / Combinaison')}</th>
                    <th className="py-3 px-3.5">{t('Tâche 1')}</th>
                    <th className="py-3 px-3.5">{t('Tâche 2')}</th>
                    <th className="py-3 px-3.5">{t('Tâche 3')}</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">{t('Score IA')}</th>
                    <th className="py-3 px-3.5 text-left whitespace-nowrap">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {submissions.map((sub) => {
                    const comboNum = sub.combination?.combinationNumber || sub.combination?.combination;
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
                            <span className="font-semibold">{dPart}</span>
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
                            <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold border inline-block ${
                              t1Ok
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : 'bg-red-50 text-red-600 border-red-300'
                            }`}>
                              {sub.wordCounts.task1} {t('mots')}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3.5">
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
                        <td className="py-3.5 px-3.5">
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
                        <td className="py-3.5 px-3.5 whitespace-nowrap">
                          {sub.aiEvaluation ? (
                            (() => {
                              const evaluatedCount = sub.aiEvaluation.evaluated_tasks?.length || (isPract ? activeTasksList.length : 3);
                              const isSingle = evaluatedCount === 1;
                              const lvl = sub.aiEvaluation.estimated_cefr_level;
                              const clb = sub.aiEvaluation.clb_level;
                              const displayLevel = clb && lvl ? `${clb} (${lvl})` : (clb || lvl);

                              if (isSingle) {
                                return lvl ? (
                                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    {displayLevel}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-xs italic font-mono">—</span>
                                );
                              }

                              return (
                                <div className="flex items-center gap-1.5">
                                  <span className="px-2 py-0.5 rounded font-mono text-xs font-black bg-blue-50 text-blue-800 border border-blue-200">
                                    {sub.aiEvaluation.overall_score} <span className="text-[10px] font-normal text-slate-400">/ 20</span>
                                  </span>
                                  {lvl && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                      {displayLevel}
                                    </span>
                                  )}
                                </div>
                              );
                            })()
                          ) : (
                            <span className="text-slate-400 text-xs italic font-mono">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3.5 text-left whitespace-nowrap">
                          <div className="flex items-center justify-start gap-2">
                            <button
                              type="button"
                              onClick={() => onViewSubmission(sub)}
                              className="px-2.5 py-1 rounded bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{t('Voir')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSubmission(sub)}
                              className="w-7 h-7 flex items-center justify-center rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                              title={t('Supprimer cette soumission')}
                              aria-label={t('Supprimer')}
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

      {/* Confidentiality / Privacy Notice */}
      <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 leading-relaxed">
        🔒 <strong>{t('Respect de la vie privée :')}</strong> {t("Vos réponses rédigées sont enregistrées de façon confidentielle dans votre compte personnel uniquement. Vos soumissions ne sont jamais publiques, aucun profil public n'est généré, et aucun classement n'est partagé.")}
      </div>
    </div>
  );
};
