import React, { useState, useEffect } from 'react';
import { QuestionsDB, ExamCombination, ExamResult } from '../types/exam';
import questionsData from '../data/questions.json';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { Header } from '../components/Header';
import { getStoredSubmissions, clearSubmissions } from '../utils/storage';
import { formatTime } from '../utils/wordCount';

interface HomeProps {
  onStartExam: (combo: ExamCombination, year: string, month: string) => void;
  onViewSubmission?: (result: ExamResult) => void;
  onDashboardClick?: () => void;
  onLoginClick?: () => void;
  onLogoutClick?: () => void;
  userEmail?: string | null;
}

const FRENCH_MONTHS_ORDER = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre'
];

export const Home: React.FC<HomeProps> = ({
  onStartExam,
  onViewSubmission,
  onDashboardClick,
  onLoginClick,
  onLogoutClick,
  userEmail
}) => {
  const db = questionsData as unknown as QuestionsDB;
  const years = Object.keys(db).sort((a, b) => Number(b) - Number(a));

  const [selectedYear, setSelectedYear] = useState<string>(years[0] || '2026');

  const getSortedMonthsForYear = (year: string): string[] => {
    if (!db[year]) return [];
    return Object.keys(db[year]).sort((a, b) => {
      const idxA = FRENCH_MONTHS_ORDER.indexOf(a);
      const idxB = FRENCH_MONTHS_ORDER.indexOf(b);
      return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });
  };
  
  const monthsForYear = getSortedMonthsForYear(selectedYear);
  const [selectedMonth, setSelectedMonth] = useState<string>(monthsForYear[0] || '');

  const rawCombos = (db[selectedYear] && db[selectedYear][selectedMonth]) || [];
  const combinations = [...rawCombos].sort(
    (a, b) => (a.combinationNumber || 0) - (b.combinationNumber || 0)
  );

  const [selectedComboIndex, setSelectedComboIndex] = useState<number>(0);
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [pastSubmissions, setPastSubmissions] = useState<ExamResult[]>([]);

  useEffect(() => {
    setPastSubmissions(getStoredSubmissions());
  }, []);

  const handleClearHistory = () => {
    if (window.confirm("Voulez-vous vraiment effacer l'historique de vos soumissions ?")) {
      clearSubmissions();
      setPastSubmissions([]);
    }
  };

  const currentCombo: ExamCombination | undefined = combinations[selectedComboIndex] || combinations[0];

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    const sortedMonths = getSortedMonthsForYear(year);
    const firstMonth = sortedMonths[0] || '';
    setSelectedMonth(firstMonth);
    setSelectedComboIndex(0);
  };

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    setSelectedComboIndex(0);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* App Header */}
      <Header
        onDashboardClick={onDashboardClick}
        onLoginClick={onLoginClick}
        onLogoutClick={onLogoutClick}
        userEmail={userEmail}
      />

      {/* Container */}
      <div className="max-w-4xl mx-auto w-full px-6 py-10 flex-1">
        {/* Banner if authenticated */}
        {userEmail ? (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded p-4 flex items-center justify-between">
            <div className="text-xs text-blue-900 font-medium">
              Connecté en tant que <strong>{userEmail}</strong>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onDashboardClick}
                className="text-xs font-bold text-blue-700 bg-white border border-blue-300 px-3 py-1.5 rounded hover:bg-blue-50"
              >
                Mon Dashboard
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-6 bg-slate-100 border border-slate-200 rounded p-3 text-xs text-slate-600 flex items-center justify-between">
            <span>Vous n'êtes pas connecté. Connectez-vous pour synchroniser vos examens avec Supabase.</span>
            <button
              type="button"
              onClick={onLoginClick}
              className="text-xs font-bold text-blue-700 underline ml-2"
            >
              Se connecter / Créer un compte
            </button>
          </div>
        )}

        {/* Header Title */}
        <div className="text-center mb-8 border-b border-slate-200 pb-6">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            TCF Canada — Expression Écrite Simulator
          </h1>
          <p className="text-slate-600 text-base font-normal">
            Entraînez-vous dans les conditions de l'examen réel.
          </p>
        </div>

        {/* Practice Selection Box */}
        <div className="bg-white border border-slate-300 rounded-lg shadow-xs p-6 mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">
            Choisissez votre entraînement
          </h2>

          {/* Year Selection Tabs */}
          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
              Année
            </label>
            <div className="flex gap-2">
              {years.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => handleYearChange(year)}
                  className={`px-5 py-2 rounded text-sm font-semibold transition-colors border ${
                    selectedYear === year
                      ? 'bg-blue-600 border-blue-700 text-white shadow-xs'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>

          {/* Month Selection Grid */}
          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
              Mois ({selectedYear})
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {monthsForYear.map((month) => {
                const count = db[selectedYear][month].length;
                const isSelected = selectedMonth === month;
                return (
                  <button
                    key={month}
                    type="button"
                    onClick={() => handleMonthChange(month)}
                    className={`text-left p-3 rounded border transition-colors flex flex-col justify-between ${
                      isSelected
                        ? 'bg-blue-50 border-blue-600 ring-1 ring-blue-600'
                        : 'bg-white border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`text-sm font-bold ${isSelected ? 'text-blue-800' : 'text-slate-800'}`}>
                      {month}
                    </span>
                    <span className="text-xs text-slate-500 mt-1">
                      {count} combinaison{count > 1 ? 's' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Combination Selector */}
          {combinations.length > 0 && (
            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                Combinaison ({selectedMonth} {selectedYear})
              </label>
              <select
                value={selectedComboIndex}
                onChange={(e) => setSelectedComboIndex(Number(e.target.value))}
                className="w-full sm:w-auto min-w-[240px] px-3 py-2 border border-slate-300 rounded text-slate-800 text-sm font-medium bg-white focus:outline-none focus:border-blue-600"
              >
                {combinations.map((c, idx) => (
                  <option key={idx} value={idx}>
                    Combinaison {c.combinationNumber || idx + 1}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Selected Combination Summary */}
          {currentCombo && (
            <div className="bg-slate-50 border border-slate-300 rounded p-4 mt-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
                <h3 className="text-base font-bold text-slate-900">
                  Combinaison {currentCombo.combinationNumber || selectedComboIndex + 1}
                </h3>
                <span className="text-xs font-semibold text-slate-600 bg-white border border-slate-300 px-2.5 py-1 rounded">
                  Durée: 60 minutes
                </span>
              </div>

              <div className="space-y-2 mb-6 text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span><strong>Tâche 1</strong> — Message (60–120 mots)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span><strong>Tâche 2</strong> — Narration (120–150 mots)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span><strong>Tâche 3</strong> — Argumentation (120–180 mots)</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsConfirmOpen(true)}
                className="w-full sm:w-auto px-6 py-2.5 rounded bg-blue-600 border border-blue-700 text-white font-bold text-sm hover:bg-blue-700 transition-colors shadow-xs"
              >
                Commencer l'examen
              </button>
            </div>
          )}
        </div>

        {/* Vos Soumissions Section */}
        <div className="bg-white border border-slate-300 rounded-lg shadow-xs p-6 mb-8">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Vos Soumissions
              </h2>
              <p className="text-xs text-slate-500">
                Historique de vos derniers examens pratiques enregistrés.
              </p>
            </div>

            {pastSubmissions.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="text-xs font-semibold text-red-600 hover:text-red-800 border border-red-200 bg-red-50 px-2.5 py-1 rounded transition-colors"
              >
                Effacer l'historique
              </button>
            )}
          </div>

          {pastSubmissions.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-sm bg-slate-50 border border-slate-200 rounded">
              Aucune soumission précédente pour le moment. Réalisez votre premier examen pour voir vos résultats ici.
            </div>
          ) : (
            <div className="space-y-3">
              {pastSubmissions.map((sub) => {
                const t1Ok = sub.wordCounts.task1 >= 60 && sub.wordCounts.task1 <= 120;
                const t2Ok = sub.wordCounts.task2 >= 120 && sub.wordCounts.task2 <= 150;
                const t3Ok = sub.wordCounts.task3 >= 120 && sub.wordCounts.task3 <= 180;

                return (
                  <div
                    key={sub.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-200 rounded hover:border-slate-300 bg-slate-50 gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-slate-900 text-sm">
                          Combinaison {sub.combination.combinationNumber} ({sub.month} {sub.year})
                        </span>
                        {sub.date && (
                          <span className="text-xs text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
                            {sub.date}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                        <span className="text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded font-sans">
                          ⏱️ {formatTime(sub.timeUsedSeconds)}
                        </span>
                        <span className={`px-2 py-0.5 rounded font-bold border ${
                          t1Ok
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-red-50 text-red-600 border-red-300'
                        }`}>
                          T1: {sub.wordCounts.task1} mots
                        </span>
                        <span className={`px-2 py-0.5 rounded font-bold border ${
                          t2Ok
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-red-50 text-red-600 border-red-300'
                        }`}>
                          T2: {sub.wordCounts.task2} mots
                        </span>
                        <span className={`px-2 py-0.5 rounded font-bold border ${
                          t3Ok
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-red-50 text-red-600 border-red-300'
                        }`}>
                          T3: {sub.wordCounts.task3} mots
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onViewSubmission && onViewSubmission(sub)}
                      className="px-4 py-1.5 rounded bg-blue-50 border border-blue-200 text-blue-700 font-semibold text-xs hover:bg-blue-100 transition-colors self-start sm:self-auto flex items-center gap-1"
                    >
                      <span>Consulter</span>
                      <span>→</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal before starting exam */}
      <ConfirmationModal
        isOpen={isConfirmOpen}
        title="Vous êtes prêt à commencer l'examen ?"
        message="Vous aurez 60 minutes pour compléter les 3 tâches dans les conditions réelles."
        confirmLabel="Commencer"
        cancelLabel="Annuler"
        onConfirm={() => {
          setIsConfirmOpen(false);
          if (currentCombo) {
            onStartExam(currentCombo, selectedYear, selectedMonth);
          }
        }}
        onCancel={() => setIsConfirmOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
        Questions sourced from publicly available TCF Canada practice material. This simulator is an independent practice tool and is not affiliated with the TCF Canada organization.
      </footer>
    </div>
  );
};
