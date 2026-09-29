import React, { useState } from 'react';
import { Home } from './pages/Home';
import { Simulator } from './pages/Simulator';
import { Results } from './pages/Results';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ExamCombination, ExamResult, TaskKey } from './types/exam';
import { saveSubmission } from './utils/storage';
import { saveSubmissionToSupabase } from './lib/supabase';
import { AuthProvider, useAuth } from './context/AuthContext';

const MainRouter: React.FC = () => {
  const { user, loading, isEmailVerified, signOut } = useAuth();

  const [view, setView] = useState<'home' | 'simulator' | 'results' | 'dashboard'>('home');
  const [activeCombo, setActiveCombo] = useState<ExamCombination | null>(null);
  const [activeYear, setActiveYear] = useState<string>('2026');
  const [activeMonth, setActiveMonth] = useState<string>('Septembre');
  const [startedAt, setStartedAt] = useState<string>('');
  const [examResult, setExamResult] = useState<ExamResult | null>(null);
  const [isPracticeMode, setIsPracticeMode] = useState<boolean>(false);
  const [practiceTask, setPracticeTask] = useState<TaskKey>('task1');
  const [practiceDuration, setPracticeDuration] = useState<number>(60);

  // 1. Loading screen while determining auth session
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-600 font-medium text-sm">Chargement de votre session...</p>
      </div>
    );
  }

  // 2. Gatekeeper: If user is not logged in OR email is not verified, show Login page as the 1st page
  if (!user || !isEmailVerified) {
    return (
      <Login
        onSuccess={() => setView('home')}
      />
    );
  }

  // 3. User is authenticated and verified -> give full access to Home, Simulator, Dashboard, and Results
  const handleStartExam = (
    combo: ExamCombination,
    year: string,
    month: string,
    practiceMode: boolean = false,
    task: TaskKey = 'task1',
    duration: number = 60
  ) => {
    setActiveCombo(combo);
    setActiveYear(year);
    setActiveMonth(month);
    setIsPracticeMode(practiceMode);
    setPracticeTask(task);
    setPracticeDuration(duration);
    setStartedAt(new Date().toISOString());
    setView('simulator');
  };

  const handleFinishExam = async (result: ExamResult) => {
    let finalResult = result;

    if (user) {
      try {
        const { data, error } = await saveSubmissionToSupabase(
          user.id,
          result,
          startedAt || new Date().toISOString()
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

    const savedLocal = saveSubmission(finalResult);
    setExamResult(savedLocal);
    setView('results');
  };

  const handleViewPastSubmission = (result: ExamResult) => {
    setExamResult(result);
    setView('results');
  };

  const handleRetakeCombination = (combo: ExamCombination, year: string, month: string) => {
    handleStartExam(combo, year, month, false, 'task1', 60);
  };

  const handleGoHome = () => {
    setView('home');
    setActiveCombo(null);
    setExamResult(null);
    setIsPracticeMode(false);
  };

  const handleSignOut = async () => {
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
        />
      )}

      {view === 'simulator' && activeCombo && (
        <Simulator
          combination={activeCombo}
          year={activeYear}
          month={activeMonth}
          isPracticeMode={isPracticeMode}
          practiceTask={practiceTask}
          durationMinutes={practiceDuration}
          onFinishExam={handleFinishExam}
          onCancelExam={handleGoHome}
        />
      )}

      {view === 'results' && examResult && (
        <Results result={examResult} onHomeClick={handleGoHome} />
      )}
    </React.Fragment>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainRouter />
    </AuthProvider>
  );
};
