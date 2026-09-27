import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchSubmissionsFromSupabase } from '../lib/supabase';
import { getStoredSubmissions, clearSubmissions, mergeSubmissions, syncStoredSubmissions } from '../utils/storage';
import { ExamResult } from '../types/exam';
import { formatTime } from '../utils/wordCount';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

interface DashboardProps {
  onStartNewExam: () => void;
  onViewSubmission: (result: ExamResult) => void;
  onRetakeCombination: (combo: any, year: string, month: string) => void;
  onHomeClick: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onStartNewExam,
  onViewSubmission,
  onRetakeCombination,
  onHomeClick
}) => {
  const { user, signOut, isConfigured } = useAuth();
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

  const handleClearHistory = () => {
    if (window.confirm("Voulez-vous vraiment effacer votre historique de soumissions ?")) {
      clearSubmissions();
      setSubmissions([]);
    }
  };

  const displayName = user?.email ? user.email.split('@')[0] : 'Utilisateur';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <Header
        onHomeClick={onHomeClick}
        subtitle="Tableau de bord utilisateur"
      />

      <div className="max-w-5xl mx-auto w-full px-6 py-8 flex-1">
        {/* User Greeting & Primary CTA */}
        <div className="bg-white border border-slate-300 rounded-lg p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Bonjour, <span className="text-blue-700">{displayName}</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {user?.email} • Bienvenue sur votre tableau de bord personnel.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onStartNewExam}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded bg-blue-600 border border-blue-700 text-white font-bold text-sm hover:bg-blue-700 transition-colors shadow-xs"
            >
              + Commencer un nouvel examen
            </button>

            <button
              type="button"
              onClick={signOut}
              className="px-3.5 py-2.5 rounded border border-slate-300 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-100 transition-colors"
            >
              Déconnexion
            </button>
          </div>
        </div>

        {/* Previous Exam Submissions Table / List */}
        <div className="bg-white border border-slate-300 rounded-lg p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Mes examens précédents
              </h2>
              <p className="text-xs text-slate-500">
                Consultez le détail de vos rédactions passées et leur nombre de mots.
              </p>
            </div>

            {submissions.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="text-xs font-semibold text-red-600 hover:text-red-800 border border-red-200 bg-red-50 px-2.5 py-1 rounded"
              >
                Effacer l'historique
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              Chargement de vos soumissions...
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-10 text-slate-500 bg-slate-50 border border-slate-200 rounded p-6">
              <p className="text-sm font-medium text-slate-700 mb-2">
                Aucun examen enregistré pour le moment.
              </p>
              <button
                type="button"
                onClick={onStartNewExam}
                className="inline-block px-4 py-2 rounded bg-blue-600 border border-blue-700 text-white text-xs font-bold hover:bg-blue-700 transition-colors mt-1"
              >
                Passer votre premier examen
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase font-bold text-slate-500 bg-slate-50">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Année</th>
                    <th className="py-3 px-3">Mois</th>
                    <th className="py-3 px-3">Combinaison</th>
                    <th className="py-3 px-3">Tâche 1</th>
                    <th className="py-3 px-3">Tâche 2</th>
                    <th className="py-3 px-3">Tâche 3</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {submissions.map((sub) => {
                    const comboNum = sub.combination?.combinationNumber || sub.combination?.combination;
                    const t1Ok = sub.wordCounts.task1 >= 60 && sub.wordCounts.task1 <= 120;
                    const t2Ok = sub.wordCounts.task2 >= 120 && sub.wordCounts.task2 <= 150;
                    const t3Ok = sub.wordCounts.task3 >= 120 && sub.wordCounts.task3 <= 180;

                    return (
                      <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3 font-medium text-slate-800 text-xs">
                          {sub.date || '—'}
                        </td>
                        <td className="py-3 px-3 text-slate-700 font-semibold">{sub.year}</td>
                        <td className="py-3 px-3 text-slate-700 font-semibold">{sub.month}</td>
                        <td className="py-3 px-3 font-bold text-slate-900">
                          Combinaison {comboNum}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold border inline-block ${
                            t1Ok
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : 'bg-red-50 text-red-600 border-red-300'
                          }`}>
                            {sub.wordCounts.task1} mots
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold border inline-block ${
                            t2Ok
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : 'bg-red-50 text-red-600 border-red-300'
                          }`}>
                            {sub.wordCounts.task2} mots
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold border inline-block ${
                            t3Ok
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : 'bg-red-50 text-red-600 border-red-300'
                          }`}>
                            {sub.wordCounts.task3} mots
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => onViewSubmission(sub)}
                              className="px-3 py-1 rounded bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors"
                            >
                              Voir
                            </button>
                            <button
                              type="button"
                              onClick={() => onRetakeCombination(sub.combination, sub.year, sub.month)}
                              className="px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-100 transition-colors"
                              title="Retenter cet examen"
                            >
                              Retenter
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
          🔒 <strong>Respect de la vie privée :</strong> Vos réponses rédigées sont enregistrées de façon confidentielle dans votre compte personnel uniquement. Vos soumissions ne sont jamais publiques, aucun profil public n'est généré, et aucun classement n'est partagé.
        </div>
      </div>

      <Footer />
    </div>
  );
};
