import React, { useState, useEffect } from 'react';
import {
  getAdminSettings,
  saveAdminSettings,
  toggleUserMonitored,
  addMonitoredUser,
  removeMonitoredUser,
  subscribeToProfilesChanges,
  getNotificationLogs,
  clearNotificationLogs,
  ADMIN_EMAIL
} from '../services/adminService';
import { getAllCandidatesDirectory, CandidateProfile, pushLocalEvaluationsToSupabase } from '../services/userProfilesService';
import { sendTestNotification } from '../services/notificationService';
import { getSupabaseAnonKey, setSupabaseAnonKey } from '../lib/supabase';
import { AdminNotificationSettings, NotificationLog } from '../types/admin';
import { ExamResult } from '../types/exam';
import { CandidateInspector } from './CandidateInspector';
import { useLanguage } from '../context/LanguageContext';
import {
  Users,
  Bell,
  History,
  Search,
  Eye,
  Shield,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw,
  Mail,
  User,
  Award,
  ChevronRight,
  Filter,
  ExternalLink
} from 'lucide-react';

interface AdminPanelProps {
  onImpersonate?: (candidate: CandidateProfile) => void;
  onViewSubmission?: (sub: ExamResult) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  onImpersonate,
  onViewSubmission
}) => {
  const { t } = useLanguage();
  const [activeAdminTab, setActiveAdminTab] = useState<'candidates' | 'settings' | 'logs'>('candidates');
  const [settings, setSettings] = useState<AdminNotificationSettings>(getAdminSettings());

  // Candidates profiles directory state
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState<boolean>(true);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'monitored' | 'with_submissions'>('all');

  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isPushingEvals, setIsPushingEvals] = useState<boolean>(false);
  const [syncEvalsMsg, setSyncEvalsMsg] = useState<string | null>(null);
  const [logs, setLogs] = useState<NotificationLog[]>([]);

  // Supabase anon key local state
  const [anonKeyInput, setAnonKeyInput] = useState<string>(getSupabaseAnonKey());
  const [showAnonKeyInput, setShowAnonKeyInput] = useState<boolean>(!getSupabaseAnonKey());

  // Refresh user directory and candidate profiles
  const refreshData = async () => {
    setIsRefreshing(true);
    setLoadingCandidates(true);
    try {
      const directory = await getAllCandidatesDirectory();
      setCandidates(directory);
      setLogs(getNotificationLogs());
    } finally {
      setIsRefreshing(false);
      setLoadingCandidates(false);
    }
  };

  useEffect(() => {
    refreshData();

    // Subscribe to new user registrations in Supabase public.profiles in real-time
    const unsubscribe = subscribeToProfilesChanges((newEmail) => {
      refreshData();
      setSaveSuccessMsg(`${t('Nouveau candidat détecté :')} ${newEmail}`);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleSaveAnonKey = (e: React.FormEvent) => {
    e.preventDefault();
    setSupabaseAnonKey(anonKeyInput.trim());
    setShowAnonKeyInput(false);
    setSaveSuccessMsg(t('Clé Supabase enregistrée ! Synchronisation en cours...'));
    setTimeout(() => {
      refreshData();
    }, 400);
  };

  const handleToggleNotifications = (enabled: boolean) => {
    const updated = { ...settings, notificationsEnabled: enabled, notifyAllUsers: enabled };
    setSettings(updated);
    saveAdminSettings(updated);
    showSaveNotice();
  };

  const handleRecipientChange = (email: string) => {
    const updated = { ...settings, recipientEmail: email };
    setSettings(updated);
  };

  const handleSaveRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    saveAdminSettings(settings);
    showSaveNotice();
  };

  const showSaveNotice = () => {
    setSaveSuccessMsg(t('Paramètres enregistrés avec succès'));
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const handleToggleUser = (email: string, currentStatus: boolean) => {
    const updated = toggleUserMonitored(email, !currentStatus);
    setSettings(updated);
    setCandidates((prev) =>
      prev.map((c) => (c.email === email ? { ...c, isMonitored: !currentStatus } : c))
    );
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserEmail.includes('@')) return;
    const clean = newUserEmail.trim().toLowerCase();
    const updated = addMonitoredUser(clean);
    setSettings(updated);
    setNewUserEmail('');
    refreshData();
    showSaveNotice();
  };

  const handleRemoveUser = (email: string) => {
    const updated = removeMonitoredUser(email);
    setSettings(updated);
    refreshData();
  };

  const handleSelectAll = () => {
    const currentUsers = candidates.map((u) => u.email);
    const updated: AdminNotificationSettings = {
      ...settings,
      notifyAllUsers: true,
      monitoredEmails: Array.from(new Set([...settings.monitoredEmails, ...currentUsers]))
    };
    setSettings(updated);
    saveAdminSettings(updated);
    refreshData();
    showSaveNotice();
  };

  const handleDeselectAll = () => {
    const updated: AdminNotificationSettings = {
      ...settings,
      notifyAllUsers: false,
      monitoredEmails: []
    };
    setSettings(updated);
    saveAdminSettings(updated);
    refreshData();
    showSaveNotice();
  };

  const handleSendTest = async () => {
    setIsSendingTest(true);
    setTestResult(null);
    try {
      const res = await sendTestNotification(settings.recipientEmail || ADMIN_EMAIL);
      setTestResult(res);
      setLogs(getNotificationLogs());
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || t("Erreur lors de l'envoi du test")
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handlePushLocalEvals = async () => {
    setIsPushingEvals(true);
    setSyncEvalsMsg(null);
    try {
      const res = await pushLocalEvaluationsToSupabase();
      if (res.error) {
        setSyncEvalsMsg(`⚠️ Erreur : ${res.error}`);
      } else {
        setSyncEvalsMsg(`✓ ${res.pushedCount} évaluation(s) synchronisée(s) vers Supabase.`);
        await refreshData();
      }
    } catch (err: any) {
      setSyncEvalsMsg(`⚠️ Erreur : ${err?.message || 'Échec de synchronisation'}`);
    } finally {
      setIsPushingEvals(false);
      setTimeout(() => setSyncEvalsMsg(null), 6000);
    }
  };

  // Filter candidates
  const filteredCandidates = candidates.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = c.email.toLowerCase().includes(q) || c.displayName.toLowerCase().includes(q);
    if (!matchesSearch) return false;

    if (filterMode === 'monitored') return c.isMonitored;
    if (filterMode === 'with_submissions') return c.submissionsCount > 0;
    return true;
  });

  // Global metrics across all candidates
  const totalSubmissions = candidates.reduce((acc, c) => acc + c.submissionsCount, 0);
  const candidatesWithSubs = candidates.filter((c) => c.submissionsCount > 0);
  const avgGlobalScore = candidatesWithSubs.length > 0
    ? Math.round(candidatesWithSubs.reduce((acc, c) => acc + c.averageScore, 0) / candidatesWithSubs.length)
    : 0;

  // IF ADMIN IS INSPECTING A SPECIFIC CANDIDATE, RENDER DEEP-DIVE INSPECTOR
  if (selectedCandidate) {
    return (
      <CandidateInspector
        candidate={selectedCandidate}
        onBack={() => setSelectedCandidate(null)}
        onImpersonate={(cand) => {
          if (onImpersonate) onImpersonate(cand);
        }}
        onViewSubmission={(sub) => {
          if (onViewSubmission) onViewSubmission(sub);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Admin Spotlight Banner (Pure Light Neomorphic Design with soft blue accents) */}
      <div className="rounded-[28px] bg-[#e8edf5] border border-white/85 shadow-[8px_8px_20px_#c2cee0,-8px_-8px_20px_#ffffff] p-6 sm:p-7 text-slate-800 transition-all">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#e8edf5] shadow-[inset_2px_2px_5px_#c2cee0,inset_-2px_-2px_5px_#ffffff] border border-white/70 flex items-center justify-center font-black text-2xl shrink-0">
              👑
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{t("Panneau d'Administration")}</h1>
                <span className="bg-amber-100 text-amber-800 border border-amber-300/80 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-2xs">
                  {t('Super Admin')}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                {t('Connecté en tant que')}{' '}
                <span className="font-bold text-slate-800">{ADMIN_EMAIL}</span> •{' '}
                {t('Consultez le profil, devoirs, scores et fautes de tous les candidats.')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={refreshData}
              disabled={isRefreshing}
              className="px-3.5 py-2.5 bg-[#e8edf5] hover:bg-white text-slate-700 hover:text-blue-600 text-xs font-bold rounded-xl border border-white/85 shadow-[3px_3px_8px_#c2cee0,-3px_-3px_8px_#ffffff] hover:shadow-[2px_2px_5px_#c2cee0,-2px_-2px_5px_#ffffff] active:shadow-[inset_2px_2px_4px_#c2cee0,inset_-2px_-2px_4px_#ffffff] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Synchroniser avec la table public.profiles de Supabase"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? '...' : 'Sync Supabase'}</span>
            </button>

            <button
              type="button"
              onClick={handlePushLocalEvals}
              disabled={isPushingEvals}
              className="px-3.5 py-2.5 bg-[#e8edf5] hover:bg-white text-slate-700 hover:text-emerald-700 text-xs font-bold rounded-xl border border-white/85 shadow-[3px_3px_8px_#c2cee0,-3px_-3px_8px_#ffffff] hover:shadow-[2px_2px_5px_#c2cee0,-2px_-2px_5px_#ffffff] active:shadow-[inset_2px_2px_4px_#c2cee0,inset_-2px_-2px_4px_#ffffff] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Pousser les évaluations enregistrées localement dans le navigateur vers Supabase"
            >
              <Sparkles className={`w-3.5 h-3.5 text-emerald-600 ${isPushingEvals ? 'animate-spin' : ''}`} />
              <span>{isPushingEvals ? '...' : 'Pousser évals locales'}</span>
            </button>

            <button
              type="button"
              onClick={handleSendTest}
              disabled={isSendingTest}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-[3px_3px_8px_rgba(37,99,235,0.35),-2px_-2px_6px_rgba(255,255,255,0.9)] hover:brightness-105 active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{isSendingTest ? t('Envoi...') : t('E-mail test')}</span>
            </button>
          </div>
        </div>

        {syncEvalsMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center justify-between">
            <span>{syncEvalsMsg}</span>
            <button type="button" onClick={() => setSyncEvalsMsg(null)} className="underline cursor-pointer">OK</button>
          </div>
        )}

        {/* 3 Admin Mode Tabs (Neomorphic 3D Tabs) */}
        <div className="mt-6 pt-5 border-t border-slate-200/70 flex items-center gap-2.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveAdminTab('candidates')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeAdminTab === 'candidates'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[3px_3px_8px_rgba(37,99,235,0.35),-2px_-2px_6px_rgba(255,255,255,0.9)] border border-blue-400/30'
                : 'bg-[#e8edf5] text-slate-600 hover:text-slate-900 border border-white/85 shadow-[3px_3px_7px_#c2cee0,-3px_-3px_7px_#ffffff] hover:shadow-[2px_2px_5px_#c2cee0,-2px_-2px_5px_#ffffff]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{t('Profils & Candidats (Tous les utilisateurs)')}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeAdminTab === 'candidates' ? 'bg-white/25 text-white' : 'bg-[#dbe5f1] text-slate-700 shadow-inner'
            }`}>
              {candidates.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveAdminTab('settings')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeAdminTab === 'settings'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[3px_3px_8px_rgba(37,99,235,0.35),-2px_-2px_6px_rgba(255,255,255,0.9)] border border-blue-400/30'
                : 'bg-[#e8edf5] text-slate-600 hover:text-slate-900 border border-white/85 shadow-[3px_3px_7px_#c2cee0,-3px_-3px_7px_#ffffff] hover:shadow-[2px_2px_5px_#c2cee0,-2px_-2px_5px_#ffffff]'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>{t('Alertes & Paramètres E-mail')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveAdminTab('logs')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeAdminTab === 'logs'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[3px_3px_8px_rgba(37,99,235,0.35),-2px_-2px_6px_rgba(255,255,255,0.9)] border border-blue-400/30'
                : 'bg-[#e8edf5] text-slate-600 hover:text-slate-900 border border-white/85 shadow-[3px_3px_7px_#c2cee0,-3px_-3px_7px_#ffffff] hover:shadow-[2px_2px_5px_#c2cee0,-2px_-2px_5px_#ffffff]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>{t('Journal des Alertes')}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeAdminTab === 'logs' ? 'bg-white/25 text-white' : 'bg-[#dbe5f1] text-slate-700 shadow-inner'
            }`}>
              {logs.length}
            </span>
          </button>
        </div>

        {testResult && (
          <div
            className={`mt-4 p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 border shadow-xs ${
              testResult.success
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : 'bg-red-50 text-red-900 border-red-300'
            }`}
          >
            <span className="font-bold text-sm">{testResult.success ? '✓' : '⚠️'}</span>
            <span>{testResult.message}</span>
          </div>
        )}

        {saveSuccessMsg && (
          <div className="mt-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold shadow-xs">
            ✓ {saveSuccessMsg}
          </div>
        )}
      </div>

      {/* Supabase Connection Helper (if anon key not yet set in .env) */}
      {showAnonKeyInput && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
                <span>🔑</span>
                <span>{t('Synchronisation Supabase (public.profiles)')}</span>
              </h3>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                {t('Pour récupérer directement les utilisateurs de public.profiles sur localhost et détecter les nouveaux utilisateurs en direct, saisissez votre clé Supabase Anon :')}
              </p>
              <form onSubmit={handleSaveAnonKey} className="mt-3 flex flex-wrap gap-2">
                <input
                  type="text"
                  value={anonKeyInput}
                  onChange={(e) => setAnonKeyInput(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                  className="flex-1 min-w-[260px] px-3 py-1.5 text-xs font-mono bg-white border border-amber-300 rounded-lg focus:outline-hidden focus:border-amber-600"
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  {t('Enregistrer')}
                </button>
              </form>
            </div>
            <button
              type="button"
              onClick={() => setShowAnonKeyInput(false)}
              className="text-amber-700 hover:text-amber-900 text-xs font-bold p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: CANDIDATES DIRECTORY & PROFILES INSPECTION */}
      {activeAdminTab === 'candidates' && (
        <div className="space-y-6">
          {/* Global Metrics 4-Card Summary Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-[24px] bg-[#e8edf5] border border-white/85 shadow-[6px_6px_16px_#c2cee0,-6px_-6px_16px_#ffffff] p-4 text-center">
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('Total Candidats')}</span>
              <span className="text-2xl font-black text-slate-800 mt-1 block">{candidates.length}</span>
              <span className="text-[11px] font-semibold text-blue-600">{t('inscrits sur le site')}</span>
            </div>

            <div className="rounded-[24px] bg-[#e8edf5] border border-white/85 shadow-[6px_6px_16px_#c2cee0,-6px_-6px_16px_#ffffff] p-4 text-center">
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('Devoirs Réalisés')}</span>
              <span className="text-2xl font-black text-slate-800 mt-1 block">{totalSubmissions}</span>
              <span className="text-[11px] font-semibold text-emerald-600">{t('évaluations IA')}</span>
            </div>

            <div className="rounded-[24px] bg-[#e8edf5] border border-white/85 shadow-[6px_6px_16px_#c2cee0,-6px_-6px_16px_#ffffff] p-4 text-center">
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('Note Moyenne')}</span>
              <span className="text-2xl font-black text-blue-700 mt-1 block">{avgGlobalScore > 0 ? `${avgGlobalScore} / 20` : '—'}</span>
              <span className="text-[11px] font-semibold text-slate-500">{t('palier B2 (CLB 7-8)')}</span>
            </div>

            <div className="rounded-[24px] bg-[#e8edf5] border border-white/85 shadow-[6px_6px_16px_#c2cee0,-6px_-6px_16px_#ffffff] p-4 text-center">
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('Alertes Email')}</span>
              <span className="text-2xl font-black text-amber-600 mt-1 block">{candidates.filter((c) => c.isMonitored).length}</span>
              <span className="text-[11px] font-semibold text-amber-700">{t('candidats surveillés')}</span>
            </div>
          </div>

          {/* Search, Filter Bar & Quick Add */}
          <div className="rounded-[24px] bg-[#e8edf5] border border-white/85 shadow-[6px_6px_16px_#c2cee0,-6px_-6px_16px_#ffffff] p-4 sm:p-5 space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('Rechercher un candidat par nom ou email...')}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 shadow-2xs font-medium"
                />
              </div>

              {/* Filter pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    filterMode === 'all'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {t('Tous')} ({candidates.length})
                </button>

                <button
                  type="button"
                  onClick={() => setFilterMode('with_submissions')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    filterMode === 'with_submissions'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {t('Avec devoirs')} ({candidates.filter((c) => c.submissionsCount > 0).length})
                </button>

                <button
                  type="button"
                  onClick={() => setFilterMode('monitored')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    filterMode === 'monitored'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {t('Surveillés')} ({candidates.filter((c) => c.isMonitored).length})
                </button>
              </div>
            </div>

            {/* Quick Add email */}
            <form onSubmit={handleAddUser} className="pt-2 border-t border-slate-200/60 flex items-center gap-2">
              <input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder={t('Ajouter un nouvel email candidat...')}
                className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 font-medium"
              />
              <button
                type="submit"
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shrink-0 shadow-2xs"
              >
                {t('+ Ajouter')}
              </button>
            </form>
          </div>

          {/* Candidates Directory Cards / Table */}
          {loadingCandidates ? (
            <div className="py-12 text-center text-slate-500 text-xs font-medium">
              {t('Chargement des profils candidats...')}
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 text-slate-500 text-xs">
              {t('Aucun candidat trouvé pour cette recherche.')}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {filteredCandidates.map((c) => (
                <div
                  key={c.email}
                  className="rounded-2xl bg-[#e8edf5] border border-white/85 shadow-[6px_6px_14px_#c2cee0,-6px_-6px_14px_#ffffff] p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all hover:shadow-[8px_8px_18px_#c2cee0,-8px_-8px_18px_#ffffff]"
                >
                  {/* Left: User Identity */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-black text-base flex items-center justify-center shrink-0 shadow-sm border border-white/40">
                      {c.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 truncate">{c.displayName}</span>
                        {c.isAdmin && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400/20 text-amber-800 border border-amber-400/50 shadow-2xs">
                            <span>👑</span>
                            <span>{t('Admin / Vous')}</span>
                          </span>
                        )}
                        {c.isMonitored && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            {t('Alertes on')}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">{c.email}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{t('Inscrit le')} {new Date(c.createdAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{t('Dernière session :')} {c.lastActiveDate || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Score & Submissions Badges */}
                  <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
                    <div className="px-3 py-1.5 rounded-xl bg-white/70 border border-slate-200/60 shadow-2xs text-center min-w-[70px]">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('Devoirs')}</span>
                      <span className="text-sm font-black text-slate-800">{c.submissionsCount}</span>
                    </div>

                    <div className="px-3 py-1.5 rounded-xl bg-white/70 border border-slate-200/60 shadow-2xs text-center min-w-[80px]">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('Moyenne')}</span>
                      <span className="text-sm font-black text-blue-700">
                        {c.averageScore > 0 ? `${c.averageScore}/20` : '—'}
                      </span>
                      {c.cefrLevel !== '—' && (
                        <span className="block text-[9px] font-extrabold text-blue-600">{c.cefrLevel}</span>
                      )}
                    </div>

                    <div className="px-3 py-1.5 rounded-xl bg-white/70 border border-slate-200/60 shadow-2xs text-center min-w-[70px]">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('Fautes')}</span>
                      <span className="text-sm font-black text-amber-600">{c.mistakesCount}</span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    {/* Toggle Alert switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={c.isMonitored}
                      onClick={() => handleToggleUser(c.email, c.isMonitored)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        c.isMonitored ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                      title={c.isMonitored ? t('Désactiver les alertes e-mail') : t('Activer les alertes e-mail')}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${
                          c.isMonitored ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>

                    {/* Inspect Profile Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedCandidate(c)}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{t('Inspecter Profil')}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: EMAIL NOTIFICATION SETTINGS */}
      {activeAdminTab === 'settings' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
              <Bell className="w-4 h-4 text-blue-600" />
              <span>{t('Paramètres de Réception des Alertes E-mail')}</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Master Switch */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <label className="text-sm font-bold text-slate-900 block">
                      {t('Interrupteur général des alertes')}
                    </label>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {t("Activer ou suspendre tous les envois d'e-mails pour toutes les soumissions de devoirs.")}
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.notificationsEnabled}
                    onClick={() => handleToggleNotifications(!settings.notificationsEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      settings.notificationsEnabled ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${
                        settings.notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 text-xs font-semibold text-slate-600">
                  {t('Statut :')}{' '}
                  {settings.notificationsEnabled ? (
                    <span className="text-emerald-600 font-bold">{t('Actif • Alertes autorisées')}</span>
                  ) : (
                    <span className="text-slate-500 font-medium">{t('Suspendu (aucune notification envoyée)')}</span>
                  )}
                </div>
              </div>

              {/* Target Notification Recipient Email */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70">
                <form onSubmit={handleSaveRecipient}>
                  <label className="text-sm font-bold text-slate-900 block mb-1">
                    {t('Boîte de réception administrateur')}
                  </label>
                  <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                    {t('Adresse email où vous recevrez en temps réel les alertes de devoirs terminés par les candidats.')}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={settings.recipientEmail}
                      onChange={(e) => handleRecipientChange(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-blue-500 font-medium"
                      required
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs"
                    >
                      {t('Sauvegarder')}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Quick bulk controls */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
              <span className="text-xs font-semibold text-slate-500">
                {t('Actions groupées sur les candidats')} :
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs font-bold text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 transition-colors cursor-pointer"
                >
                  {t('Surveiller tous les candidats')}
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-xs font-semibold text-slate-600 hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-300 transition-colors cursor-pointer"
                >
                  {t('Désactiver toutes les alertes')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: NOTIFICATION AUDIT LOGS */}
      {activeAdminTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              {t('Journal des Alertes Envoyées')} ({logs.length})
            </h3>
            {logs.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  clearNotificationLogs();
                  setLogs([]);
                }}
                className="text-xs font-bold text-red-600 hover:text-red-700 cursor-pointer"
              >
                {t('Effacer l\'historique')}
              </button>
            )}
          </div>

          {logs.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 text-slate-500 text-xs">
              {t('Aucune alerte enregistrée dans le journal.')}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-white shadow-2xs overflow-hidden">
              {logs.map((log) => (
                <div key={log.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${log.status === 'sent' ? 'bg-emerald-500' : 'bg-blue-400'}`} />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">{log.subject}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''} • Destinataire : {log.recipient}
                      </div>
                    </div>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    log.status === 'sent' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
