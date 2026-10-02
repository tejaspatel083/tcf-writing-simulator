import React, { useState, useEffect } from 'react';
import { Home } from './pages/Home';
import { Simulator } from './pages/Simulator';
import { Results } from './pages/Results';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Feedback } from './pages/Feedback';
import { ExamCombination, ExamResult, TaskKey } from './types/exam';
import { saveSubmission } from './utils/storage';
import { saveSubmissionToSupabase } from './lib/supabase';
import { getLocalISOString } from './utils/dateUtils';
import { AuthProvider, useAuth } from './context/AuthContext';

const MainRouter: React.FC = () => {
  const { user, loading, isEmailVerified, signOut } = useAuth();

  const [view, setView] = useState<'home' | 'simulator' | 'results' | 'dashboard' | 'feedback'>('home');
  const [activeCombo, setActiveCombo] = useState<ExamCombination | null>(null);
  const [activeYear, setActiveYear] = useState<string>('2026');
  const [activeMonth, setActiveMonth] = useState<string>('Septembre');
  const [startedAt, setStartedAt] = useState<string>('');
  const [examResult, setExamResult] = useState<ExamResult | null>(null);
  const [isPracticeMode, setIsPracticeMode] = useState<boolean>(false);
  const [practiceTask, setPracticeTask] = useState<TaskKey>('task1');
  const [practiceTasks, setPracticeTasks] = useState<TaskKey[]>(['task1']);
  const [practiceDuration, setPracticeDuration] = useState<number>(60);

  // Automatically scroll to the top of the page whenever the view/route changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [view]);

  // 1. Loading screen while determining auth session
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-600 font-medium text-sm">Chargement de votre session...</p>
      </div>
    );
  }

  // 1.5. If view is feedback, accessible by any user
  if (view === 'feedback') {
    return (
      <Feedback
        onHomeClick={() => setView('home')}
        userEmail={user?.email}
      />
    );
  }

  // 2. Gatekeeper: If user is not logged in OR email is not verified, show Login page as the 1st page
  if (!user || !isEmailVerified) {
    return (
      <Login
        onSuccess={() => setView('home')}
        onFeedbackClick={() => setView('feedback')}
      />
    );
  }

  // 3. User is authenticated and verified -> give full access to Home, Simulator, Dashboard, and Results
  const handleStartExam = (
    combo: ExamCombination,
    year: string,
    month: string,
    practiceMode: boolean = false,
    task: TaskKey | TaskKey[] = 'task1',
    duration: number = 60
  ) => {
    setActiveCombo(combo);
    setActiveYear(year);
    setActiveMonth(month);
    setIsPracticeMode(practiceMode);
    if (Array.isArray(task)) {
      setPracticeTasks(task);
      setPracticeTask(task[0] || 'task1');
    } else {
      setPracticeTasks([task]);
      setPracticeTask(task);
    }
    setPracticeDuration(duration);
    setStartedAt(getLocalISOString());
    setView('simulator');
  };

  const handleFinishExam = async (result: ExamResult) => {
    let finalResult = result;

    if (user) {
      try {
        const { data, error } = await saveSubmissionToSupabase(
          user.id,
          result,
          startedAt || getLocalISOString(new Date(Date.now() - (result.timeUsedSeconds || 0) * 1000))
        );
        if (data?.id) {
          finalResult = {
            ...result,
            id: data.id
          };
        }
      } catch (err) {
        console.error('Error saving submission to Supabase:', err);
      }
    }

    setStartedAt('');
    const savedLocal = saveSubmission(finalResult);
    setExamResult(savedLocal);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    setView('results');
  };

  const handleViewPastSubmission = (result: ExamResult) => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    setExamResult(result);
    setView('results');
  };

  const handleRetakeCombination = (combo: ExamCombination, year: string, month: string) => {
    handleStartExam(combo, year, month, false, 'task1', 60);
  };

  const handleGoHome = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    setView('home');
    setActiveCombo(null);
    setExamResult(null);
    setStartedAt('');
    setIsPracticeMode(false);
  };

  const handleSignOut = async () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    await signOut();
    setView('home');
  };

  return (
    <React.Fragment>
      {view === 'home' && (
        <Home
          onStartExam={handleStartExam}
          onViewSubmission={handleViewPastSubmission}
          onDashboardClick={() => setView('dashboard')}
          onFeedbackClick={() => setView('feedback')}
          onLogoutClick={handleSignOut}
          userEmail={user.email}
        />
      )}

      {view === 'dashboard' && (
        <Dashboard
          onStartNewExam={handleGoHome}
          onViewSubmission={handleViewPastSubmission}
          onRetakeCombination={handleRetakeCombination}
          onHomeClick={handleGoHome}
          onFeedbackClick={() => setView('feedback')}
        />
      )}

      {view === 'simulator' && activeCombo && (
        <Simulator
          combination={activeCombo}
          year={activeYear}
          month={activeMonth}
          isPracticeMode={isPracticeMode}
          practiceTask={practiceTasks.join(',')}
          practiceTasks={practiceTasks}
          durationMinutes={practiceDuration}
          onFinishExam={handleFinishExam}
          onCancelExam={handleGoHome}
        />
      )}

      {view === 'results' && examResult && (
        <Results
          result={examResult}
          onHomeClick={handleGoHome}
          onFeedbackClick={() => setView('feedback')}
        />
      )}
    </React.Fragment>
  );
};

import { LanguageProvider } from './context/LanguageContext';

export const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AuthProvider>
        <MainRouter />
      </AuthProvider>
    </LanguageProvider>
  );
};
