import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchSubmissionsFromSupabase } from '../lib/supabase';
import { getStoredSubmissions, mergeSubmissions, syncStoredSubmissions } from '../utils/storage';
import { ExamResult } from '../types/exam';
import { SavedMistake, CefrLevel } from '../types/aiEvaluation';
import { AdminPanel } from '../components/AdminPanel';
import { MistakesView } from '../components/MistakesView';
import { DashboardAnalytics } from '../components/DashboardAnalytics';
import { DashboardBentoLayout } from '../components/DashboardBentoLayout';
import { getStoredMistakes, mergeMistakesFromSubmissions } from '../utils/mistakesStorage';
import { useLanguage } from '../context/LanguageContext';
import { mapScoreToTcfCanadaLevels } from '../services/geminiEvaluator';

interface DashboardProps {
  onStartNewExam: () => void;
  onViewSubmission: (result: ExamResult) => void;
  onRetakeCombination: (combo: any, year: string, month: string) => void;
  onHomeClick: () => void;
  onFeedbackClick?: () => void;
  initialTab?: 'submissions' | 'mistakes' | 'admin';
  onTabChange?: (tab: 'submissions' | 'mistakes' | 'admin') => void;
  onNavigateToSubmissions?: (tab?: 'exams' | 'mistakes') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onStartNewExam,
  onViewSubmission,
  initialTab,
  onTabChange,
  onNavigateToSubmissions
}) => {
  const { user, userName, isConfigured, isAdmin } = useAuth();
  const { language } = useLanguage();
  const [submissions, setSubmissions] = useState<ExamResult[]>([]);
  const [mistakes, setMistakes] = useState<SavedMistake[]>([]);
  const [, setLoading] = useState<boolean>(true);
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
      if (!isNaN(parsed.getTime())) {
        return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
      }
      return null;
    };

    submissions.forEach((s) => {
      const d = parseDateToMidnight(s.date);
      if (d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        set.add(`${y}-${m}-${day}`);
      }
    });

    return set;
  }, [submissions]);

  // Interactive Month Navigation in Calendar
  const [calendarDate, setCalendarDate] = useState<Date>(() => new Date());

  const calendarGrid = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const days: Array<{
      day: number | null;
      key: string;
      isPracticed: boolean;
      isToday: boolean;
    }> = [];

    // Empty cells before first day of month
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({
        day: null,
        key: `empty-head-${i}`,
        isPracticed: false,
        isToday: false
      });
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
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
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
          {/* Main Bento Layout (Direct view, no accordion dropdown, bento format only) */}
          <DashboardBentoLayout
            userName={userName}
            submissions={submissions}
            mistakes={mistakes}
            targetGoal={targetGoal}
            perfStats={perfStats}
            calendarGrid={calendarGrid}
            weekDays={weekDays}
            handlePrevMonth={handlePrevMonth}
            handleNextMonth={handleNextMonth}
            onStartNewExam={onStartNewExam}
            onViewSubmission={onViewSubmission}
            onSwitchTab={handleSwitchTab}
            onNavigateToSubmissions={onNavigateToSubmissions}
          />

          {/* Performance Analytics & Progress Visualizations (Score Progress & Competency Radar Graph) */}
          <DashboardAnalytics
            submissions={submissions}
            mistakes={mistakes}
            onStartNewExam={onStartNewExam}
            onViewSubmission={onViewSubmission}
          />
        </div>
      )}
    </div>
  );
};
