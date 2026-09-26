import React, { useState } from 'react';
import { Home } from './pages/Home';
import { Simulator } from './pages/Simulator';
import { Results } from './pages/Results';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ExamCombination, ExamResult } from './types/exam';
import { saveSubmission } from './utils/storage';
import { saveSubmissionToSupabase } from './lib/supabase';
import { AuthProvider, useAuth } from './context/AuthContext';

const MainRouter: React.FC = () => {
  const { user, signOut } = useAuth();

  const [view, setView] = useState<'home' | 'simulator' | 'results' | 'login' | 'dashboard'>('home');
  const [activeCombo, setActiveCombo] = useState<ExamCombination | null>(null);
  const [activeYear, setActiveYear] = useState<string>('2026');
  const [activeMonth, setActiveMonth] = useState<string>('Septembre');
  const [startedAt, setStartedAt] = useState<string>('');
  const [examResult, setExamResult] = useState<ExamResult | null>(null);

  const handleStartExam = (combo: ExamCombination, year: string, month: string) => {
    setActiveCombo(combo);
    setActiveYear(year);
    setActiveMonth(month);
    setStartedAt(new Date().toISOString());
    setView('simulator');
  };

  const handleFinishExam = async (result: ExamResult) => {
    const savedLocal = saveSubmission(result);
    setExamResult(savedLocal);

    if (user) {
      await saveSubmissionToSupabase(user.id, result, startedAt || new Date().toISOString());
    }

    setView('results');
  };

  const handleViewPastSubmission = (result: ExamResult) => {
    setExamResult(result);
    setView('results');
  };

  const handleRetakeCombination = (combo: ExamCombination, year: string, month: string) => {
    handleStartExam(combo, year, month);
  };

  const handleGoHome = () => {
    setView('home');
    setActiveCombo(null);
    setExamResult(null);
  };

  return (
    <React.Fragment>
      {view === 'home' && (
        <Home
          onStartExam={handleStartExam}
          onViewSubmission={handleViewPastSubmission}
          onDashboardClick={() => setView(user ? 'dashboard' : 'login')}
          onLoginClick={() => setView('login')}
          onLogoutClick={signOut}
          userEmail={user?.email}
        />
      )}

      {view === 'login' && (
        <Login
          onSuccess={() => setView('dashboard')}
          onHomeClick={handleGoHome}
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
