import React, { useState, useEffect, useRef } from 'react';
import { QuestionsDB, ExamCombination, ExamResult } from '../types/exam';
import questionsData from '../data/questions.json';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { fetchSubmissionsFromSupabase } from '../lib/supabase';
import {
  getStoredSubmissions,
  syncStoredSubmissions,
  mergeSubmissions
} from '../utils/storage';

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

/**
 * Normalizes month names across French and English, removing accents and extra text
 * so "May 2026", "Mai", "May", "mai" all map cleanly to "mai".
 */
export const normalizeMonth = (m?: string): string => {
  if (!m) return '';
  const firstWord = m.trim().split(/[\s_-]+/)[0];
  const cleaned = firstWord.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const MONTH_MAP: Record<string, string> = {
    january: 'janvier',
    janvier: 'janvier',
    february: 'fevrier',
    fevrier: 'fevrier',
    march: 'mars',
    mars: 'mars',
    april: 'avril',
    avril: 'avril',
    may: 'mai',
    mai: 'mai',
    june: 'juin',
    juin: 'juin',
    july: 'juillet',
    juillet: 'juillet',
    august: 'aout',
    aout: 'aout',
    september: 'septembre',
    septembre: 'septembre',
    october: 'octobre',
    octobre: 'octobre',
    november: 'novembre',
    novembre: 'novembre',
    december: 'decembre',
    decembre: 'decembre'
  };
  return MONTH_MAP[cleaned] || cleaned;
};

export const Home: React.FC<HomeProps> = ({
  onStartExam,
  onDashboardClick,
  onLoginClick,
  onLogoutClick,
  userEmail
}) => {
  const { user, isConfigured } = useAuth();
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
  const [comboDropdownOpen, setComboDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setComboDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch submissions from Supabase and LocalStorage in the background
  // to power the combination completion indicators
  useEffect(() => {
    let isMounted = true;

    async function loadSubmissions() {
      const local = getStoredSubmissions();
      if (isMounted) {
        setPastSubmissions(local);
      }

      if (user && isConfigured) {
        try {
          const { submissions: dbSubs, error } = await fetchSubmissionsFromSupabase(user.id);
          if (!error && dbSubs && isMounted) {
            const merged = mergeSubmissions(dbSubs, local);
            setPastSubmissions(merged);
            syncStoredSubmissions(merged);
          }
        } catch (e) {
          console.error('Erreur lors du chargement des soumissions:', e);
        }
      }
    }

    loadSubmissions();

    return () => {
      isMounted = false;
    };
  }, [user, isConfigured]);

  const currentCombo: ExamCombination | undefined = combinations[selectedComboIndex] || combinations[0];

  // Helper: check if a combination has been submitted before
  const isCombinationCompleted = (comboNum: number): boolean => {
    return pastSubmissions.some((sub) => {
      if (!sub) return false;
      const matchYear = String(sub.year || '').trim() === String(selectedYear || '').trim();
      const matchMonth = normalizeMonth(sub.month) === normalizeMonth(selectedMonth);
      const subComboNum = Number(sub.combination?.combinationNumber ?? sub.combination?.combination);
      return matchYear && matchMonth && subComboNum === Number(comboNum);
    });
  };

  // Helper: count completed combinations for a given month
  const getCompletedCountForMonth = (monthName: string): number => {
    const finished = new Set<number>();
    pastSubmissions.forEach((sub) => {
      if (
        String(sub.year || '').trim() === String(selectedYear || '').trim() &&
        normalizeMonth(sub.month) === normalizeMonth(monthName)
      ) {
        const num = Number(sub.combination?.combinationNumber ?? sub.combination?.combination);
        if (!isNaN(num) && num > 0) finished.add(num);
      }
    });
    return finished.size;
  };

  const currentComboNum = currentCombo?.combinationNumber || selectedComboIndex + 1;
  const isCurrentComboDone = isCombinationCompleted(currentComboNum);

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    const sortedMonths = getSortedMonthsForYear(year);
    const firstMonth = sortedMonths[0] || '';
    setSelectedMonth(firstMonth);
    setSelectedComboIndex(0);
    setComboDropdownOpen(false);
  };

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    setSelectedComboIndex(0);
    setComboDropdownOpen(false);
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

      {/* Main Container */}
      <div className="max-w-4xl mx-auto w-full px-6 py-10 flex-1">
        {/* Banner if authenticated */}
        {userEmail ? (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="text-xs text-blue-900 font-medium">
              Connecté en tant que <strong>{userEmail}</strong>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onDashboardClick}
                className="text-xs font-bold text-blue-700 bg-white border border-blue-300 px-3 py-1.5 rounded hover:bg-blue-50 cursor-pointer transition-colors shadow-2xs"
              >
                Mon Dashboard (Mes soumissions) →
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-6 bg-slate-100 border border-slate-200 rounded p-3 text-xs text-slate-600 flex items-center justify-between">
            <span>Vous n'êtes pas connecté. Connectez-vous pour synchroniser vos examens avec Supabase.</span>
            <button
              type="button"
              onClick={onLoginClick}
              className="text-xs font-bold text-blue-700 underline ml-2 cursor-pointer"
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
                  className={`px-5 py-2 rounded text-sm font-semibold transition-colors border cursor-pointer ${
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
                const completedCount = getCompletedCountForMonth(month);

                return (
                  <button
                    key={month}
                    type="button"
                    onClick={() => handleMonthChange(month)}
                    className={`text-left p-3 rounded border transition-colors flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border-blue-600 ring-1 ring-blue-600'
                        : 'bg-white border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-bold ${isSelected ? 'text-blue-800' : 'text-slate-800'}`}>
                        {month}
                      </span>
                      {completedCount > 0 && (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded-full">
                          ✓ {completedCount}/{count}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 mt-1">
                      {count} combinaison{count > 1 ? 's' : ''}
                      {completedCount > 0 && (
                        <span className="text-emerald-700 font-semibold"> • {completedCount} faite{completedCount > 1 ? 's' : ''}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Combination Selector with Green Indicator for Completed Combinations */}
          {combinations.length > 0 && (
            <div className="mb-6" ref={dropdownRef}>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Combinaison ({selectedMonth} {selectedYear})
                </label>
                {isCurrentComboDone && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
                    <span>✓</span> Déjà complétée (Refaire disponible)
                  </span>
                )}
              </div>

              {/* Interactive Custom Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setComboDropdownOpen(!comboDropdownOpen)}
                  className={`w-full sm:w-auto min-w-[280px] px-3.5 py-2.5 rounded-lg border text-left flex items-center justify-between gap-3 text-sm font-semibold transition-all cursor-pointer shadow-2xs ${
                    isCurrentComboDone
                      ? 'bg-emerald-50/80 border-emerald-400 text-emerald-950 ring-1 ring-emerald-400/50'
                      : 'bg-white border-slate-300 text-slate-800 hover:border-slate-400 focus:border-blue-600'
                  }`}
                  aria-expanded={comboDropdownOpen}
                >
                  <div className="flex items-center gap-2">
                    {isCurrentComboDone ? (
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                        ✓
                      </span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0"></span>
                    )}
                    <span>
                      Combinaison {currentCombo?.combinationNumber || selectedComboIndex + 1}
                    </span>
                    {isCurrentComboDone && (
                      <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded">
                        ✓ Faite
                      </span>
                    )}
                  </div>
                  <span
                    className="text-xs text-slate-500 transition-transform duration-200 inline-block"
                    style={{ transform: comboDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  >
                    ▼
                  </span>
                </button>

                {/* Dropdown Menu Options */}
                {comboDropdownOpen && (
                  <div className="absolute z-30 mt-1.5 w-full sm:w-[380px] max-h-72 overflow-y-auto bg-white border border-slate-300 rounded-lg shadow-xl p-1.5 space-y-1 animate-fadeIn">
                    <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1 flex items-center justify-between">
                      <span>Sélectionner une combinaison</span>
                      <span className="text-emerald-700 font-semibold normal-case">Vert = Déjà complétée</span>
                    </div>

                    {combinations.map((c, idx) => {
                      const comboNum = c.combinationNumber || idx + 1;
                      const isDone = isCombinationCompleted(comboNum);
                      const isSelected = selectedComboIndex === idx;

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setSelectedComboIndex(idx);
                            setComboDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs transition-all flex items-center justify-between gap-3 cursor-pointer ${
                            isDone
                              ? isSelected
                                ? 'bg-emerald-100 text-emerald-950 font-bold border-2 border-emerald-500 shadow-xs'
                                : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 font-semibold border border-emerald-300'
                              : isSelected
                              ? 'bg-blue-50 text-blue-900 font-bold border border-blue-300'
                              : 'text-slate-700 hover:bg-slate-100 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {isDone ? (
                              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs">
                                ✓
                              </span>
                            ) : (
                              <span className="w-5 h-5 rounded-full border border-slate-300 bg-white text-slate-400 flex items-center justify-center text-[10px] shrink-0">
                                •
                              </span>
                            )}
                            <span className={isDone ? 'font-bold text-emerald-950 text-sm' : 'text-slate-800 font-medium text-sm'}>
                              Combinaison {comboNum}
                            </span>
                          </div>

                          {isDone ? (
                            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-200/90 border border-emerald-400 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                              ✓ Déjà faite (Refaire disponible)
                            </span>
                          ) : isSelected ? (
                            <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                              Sélectionnée
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Informative Banner if Selected Combo is Already Done */}
              {isCurrentComboDone && (
                <div className="mt-3 p-3.5 rounded-lg bg-emerald-50 border border-emerald-300 flex items-start gap-2.5 text-xs text-emerald-900 shadow-2xs">
                  <span className="text-base text-emerald-600 font-bold leading-none mt-0.5 shrink-0">✓</span>
                  <div>
                    <p className="font-bold text-emerald-950">
                      Vous avez déjà complété la Combinaison {currentComboNum} ({selectedMonth} {selectedYear}).
                    </p>
                    <p className="text-emerald-800 mt-0.5">
                      Vous pouvez la <strong>refaire à tout moment</strong> pour vous réentraîner. Votre nouvelle tentative sera enregistrée séparément dans votre tableau de bord.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Selected Combination Summary Card */}
          {currentCombo && (
            <div className="bg-slate-50 border border-slate-300 rounded p-4 mt-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Combinaison {currentCombo.combinationNumber || selectedComboIndex + 1}
                  </h3>
                  {isCurrentComboDone && (
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
                      ✓ Déjà complétée
                    </span>
                  )}
                </div>
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
                className={`w-full sm:w-auto px-6 py-2.5 rounded font-bold text-sm transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer ${
                  isCurrentComboDone
                    ? 'bg-emerald-600 border border-emerald-700 text-white hover:bg-emerald-700'
                    : 'bg-blue-600 border border-blue-700 text-white hover:bg-blue-700'
                }`}
              >
                {isCurrentComboDone ? (
                  <>
                    <span>Refaire cet examen</span>
                    <span>↻</span>
                  </>
                ) : (
                  <span>Commencer l'examen</span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Dashboard Quick Access Card */}
        {userEmail && (
          <div className="bg-white border border-slate-300 rounded-lg p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                Consulter vos soumissions passées
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Retrouvez l'historique complet de vos épreuves, vos décomptes de mots et vos rédactions dans votre tableau de bord personnel.
              </p>
            </div>
            <button
              type="button"
              onClick={onDashboardClick}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shrink-0 shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <span>Accéder au Dashboard</span>
              <span>→</span>
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Modal before starting exam */}
      <ConfirmationModal
        isOpen={isConfirmOpen}
        title={
          isCurrentComboDone
            ? `Refaire la Combinaison ${currentComboNum} ?`
            : "Vous êtes prêt à commencer l'examen ?"
        }
        message={
          isCurrentComboDone
            ? "Vous avez déjà soumis cette combinaison auparavant. Vous pouvez la refaire dans les conditions réelles (60 minutes). Votre nouvelle soumission sera enregistrée séparément dans votre tableau de bord."
            : "Vous aurez 60 minutes pour compléter les 3 tâches dans les conditions réelles."
        }
        confirmLabel={isCurrentComboDone ? 'Refaire l’examen' : 'Commencer'}
        cancelLabel="Annuler"
        onConfirm={() => {
          setIsConfirmOpen(false);
          if (currentCombo) {
            onStartExam(currentCombo, selectedYear, selectedMonth);
          }
        }}
        onCancel={() => setIsConfirmOpen(false)}
      />

      {/* Footer with Terms and Conditions */}
      <Footer />
    </div>
  );
};
