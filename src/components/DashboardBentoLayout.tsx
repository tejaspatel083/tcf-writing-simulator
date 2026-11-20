import React, { useState, useMemo } from 'react';
import { ExamResult } from '../types/exam';
import { SavedMistake, CefrLevel } from '../types/aiEvaluation';
import { CANONICAL_CATEGORIES, normalizeCategory } from '../utils/mistakesStorage';
import { useLanguage } from '../context/LanguageContext';
import {
  BarChart3,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Gauge,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  PlusCircle,
  Eye
} from 'lucide-react';

interface DashboardBentoLayoutProps {
  userName?: string | null;
  submissions: ExamResult[];
  mistakes: SavedMistake[];
  targetGoal: CefrLevel;
  perfStats: {
    avgScore: number;
    avgCefr: CefrLevel | '—';
    bestScore: number;
    bestCefr: CefrLevel | '—';
  };
  calendarGrid: {
    year: number;
    month: number;
    days: Array<{
      day: number | null;
      key: string;
      isPracticed: boolean;
      isToday: boolean;
    }>;
    practicedInMonth: number;
    monthLabel: string;
  };
  weekDays: string[];
  handlePrevMonth: (e: React.MouseEvent) => void;
  handleNextMonth: (e: React.MouseEvent) => void;
  onStartNewExam: () => void;
  onViewSubmission: (result: ExamResult) => void;
  onSwitchTab: (tab: 'submissions' | 'mistakes' | 'admin') => void;
  onNavigateToSubmissions?: (tab?: 'exams' | 'mistakes') => void;
}

// 3D Neomorphic Tile Container with pure light theme (#e8edf5, dual directional shadows)
function BentoTile({
  title,
  action,
  className = '',
  children,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`relative flex min-w-0 flex-col overflow-hidden rounded-[28px] border border-white/85 bg-[#e8edf5] p-5 sm:p-6 text-slate-900 shadow-[8px_8px_20px_#c2cee0,-8px_-8px_20px_#ffffff] transition-all hover:shadow-[10px_10px_24px_#b8c7db,-10px_-10px_24px_#ffffff] ${className}`}
    >
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1 pt-0.5 bg-transparent">
          {title && <div className="inline-flex items-center">{title}</div>}
          {action && <div className="inline-flex items-center">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export const DashboardBentoLayout: React.FC<DashboardBentoLayoutProps> = ({
  userName,
  submissions,
  mistakes,
  targetGoal,
  perfStats,
  calendarGrid,
  weekDays,
  handlePrevMonth,
  handleNextMonth,
  onStartNewExam,
  onViewSubmission,
  onSwitchTab,
  onNavigateToSubmissions,
}) => {
  const { language } = useLanguage();
  const totalSubmissions = submissions.length;
  const evaluatedSubmissions = submissions.filter((s) => s.aiEvaluation).length;
  const lastSubmissionDate = submissions[0]?.date ? submissions[0].date.split(' ')[0] : '—';

  // 30-Day Activity Sparkline / Strip (Daily activity over the last 30 days)
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);

  const thirtyDayHistory = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const submissionDateSet = new Set<string>();
    submissions.forEach((s) => {
      if (!s.date) return;
      const clean = s.date.trim();
      const datePart = clean.split(/(?: à |[ ,T]+)/)[0].trim();
      const dmy = datePart.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmy) {
        submissionDateSet.add(`${dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`);
        return;
      }
      const ymd = datePart.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
      if (ymd) {
        submissionDateSet.add(`${ymd[1]}-${String(ymd[2]).padStart(2, '0')}-${String(ymd[3]).padStart(2, '0')}`);
        return;
      }
      const parsed = new Date(clean);
      if (!isNaN(parsed.getTime())) {
        submissionDateSet.add(
          `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
        );
      }
    });

    const list: Array<{ dateKey: string; label: string; active: boolean }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const label = d.toLocaleDateString(language === 'en' ? 'en-US' : 'fr-FR', {
        month: 'short',
        day: 'numeric',
      });
      list.push({
        dateKey: key,
        label,
        active: submissionDateSet.has(key),
      });
    }
    return list;
  }, [submissions, language]);

  // Mistakes Category Distribution for Bento Allocation Tile
  const mistakeCategoriesCount = useMemo(() => {
    const counts: Record<string, number> = {};
    CANONICAL_CATEGORIES.forEach((c) => (counts[c] = 0));
    mistakes.forEach((m) => {
      const cat = normalizeCategory(m.category);
      counts[cat] = (counts[cat] || 0) + 1;
    });

    const categoryColors: Record<string, { bg: string; text: string; bar: string }> = {
      'Grammaire': { bg: 'bg-blue-100 text-blue-800', text: 'text-blue-700', bar: 'bg-blue-500' },
      'Orthographe / Accents': { bg: 'bg-emerald-100 text-emerald-800', text: 'text-emerald-700', bar: 'bg-emerald-500' },
      'Conjugaison / Temps': { bg: 'bg-amber-100 text-amber-800', text: 'text-amber-700', bar: 'bg-amber-500' },
      'Structure de phrase': { bg: 'bg-purple-100 text-purple-800', text: 'text-purple-700', bar: 'bg-purple-500' },
      'Vocabulaire': { bg: 'bg-rose-100 text-rose-800', text: 'text-rose-700', bar: 'bg-rose-500' },
      'Autres': { bg: 'bg-slate-200 text-slate-800', text: 'text-slate-700', bar: 'bg-slate-400' },
    };

    const total = mistakes.length;
    return CANONICAL_CATEGORIES.map((cat) => ({
      name: cat,
      count: counts[cat] || 0,
      pct: total > 0 ? Math.round(((counts[cat] || 0) / total) * 100) : 0,
      colors: categoryColors[cat] || { bg: 'bg-slate-100 text-slate-700', text: 'text-slate-700', bar: 'bg-slate-500' },
    })).filter((c) => c.count > 0 || total === 0).slice(0, 5);
  }, [mistakes]);

  // 3D Neomorphic Speedometer Gauge Calculations
  // Score range: 0 to 20
  // Arc angle: 180 degrees (from PI at score 0 to 0 at score 20)
  const gaugePercent = Math.min(Math.max(perfStats.avgScore / 20, 0), 1);
  const arcRadius = 56;
  const centerX = 80;
  const centerY = 74;
  const arcLength = Math.PI * arcRadius; // ~175.93
  const strokeDashoffset = arcLength * (1 - gaugePercent);
  const needleAngle = Math.PI * (1 - gaugePercent);
  const needleLength = 43;
  const needleX = centerX + Math.cos(needleAngle) * needleLength;
  const needleY = centerY - Math.sin(needleAngle) * needleLength;

  return (
    <div className="w-full space-y-4">
      {/* Bento Grid layout: 4 columns on large screens */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* ======================================================== */}
        {/* TILE 1: HERO TILE (Spans 2 columns on lg)                */}
        {/* Greeting, Net Submissions, Progress Bar & 30-day Strip   */}
        {/* ======================================================== */}
        <BentoTile
          className="sm:col-span-2 lg:col-span-2"
          title={
            <div className="px-3.5 py-1.5 rounded-full bg-[#e8edf5] shadow-[2px_2px_5px_#c2cee0,-2px_-2px_5px_#ffffff] border border-white/85 inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.6)] animate-pulse" />
              <span className="text-[11px] sm:text-xs font-black text-slate-700 uppercase tracking-wider">
                {language === 'en' ? 'TCF Writing Dashboard' : 'Tableau de bord TCF Canada'}
              </span>
            </div>
          }
          action={
            <button
              type="button"
              onClick={onStartNewExam}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-[4px_4px_10px_rgba(37,99,235,0.38),-3px_-3px_8px_rgba(255,255,255,0.95)] hover:shadow-[2px_2px_6px_rgba(37,99,235,0.45)] hover:brightness-105 active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.35)] transition-all cursor-pointer mr-1 mt-0.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{language === 'en' ? 'New Exam' : 'Nouvel Examen'}</span>
            </button>
          }
        >
          <div className="flex flex-col justify-between h-full space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {language === 'en' ? 'Bonjour' : 'Bonjour'},{' '}
                  <span className="text-blue-600">{userName || (language === 'en' ? 'Student' : 'Étudiant')}</span> 👋
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
                  {language === 'en'
                    ? "Here's your TCF Canada writing preparation at a glance."
                    : 'Voici votre progression d’entraînement TCF Canada au format Bento.'}
                </p>
              </div>

              {/* Total Submissions Metric Counter */}
              <div className="text-right">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#e8edf5] shadow-[inset_1px_1px_3px_#c2cee0,inset_-1px_-1px_3px_#ffffff] border border-white/60 inline-block mb-1">
                  {language === 'en' ? 'Submitted Exams' : 'Examens Soumis'}
                </span>
                <div className="flex items-baseline justify-end gap-1.5 mt-0.5">
                  <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                    {evaluatedSubmissions}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    / {totalSubmissions} {language === 'en' ? 'evaluated' : 'évalués'}
                  </span>
                </div>
              </div>
            </div>

            {/* Evaluation Progress Bar with 3D Inset Groove */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-600">
                  {language === 'en' ? 'Evaluation Rate' : "Taux d'évaluation IA"}
                </span>
                <span className="text-blue-600 font-black">
                  {totalSubmissions > 0 ? Math.round((evaluatedSubmissions / totalSubmissions) * 100) : 0}%
                </span>
              </div>
              <div className="w-full h-3 bg-[#e8edf5] shadow-[inset_2px_2px_5px_#c2cee0,inset_-2px_-2px_5px_#ffffff] rounded-full p-0.5 border border-white/60 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-indigo-600 rounded-full shadow-[2px_2px_4px_rgba(37,99,235,0.35)] transition-all duration-700 ease-out"
                  style={{
                    width: `${totalSubmissions > 0 ? (evaluatedSubmissions / totalSubmissions) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* 30-Day Activity Strip with 3D Inset Tray */}
            <div className="pt-2 border-t border-slate-200/50">
              <div className="flex items-center justify-between text-[11px] mb-2 font-medium text-slate-500">
                <div className="px-3 py-1 rounded-full bg-[#e8edf5] shadow-[2px_2px_4px_#c2cee0,-2px_-2px_4px_#ffffff] border border-white/70 inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  <span>{language === 'en' ? 'Last 30 days activity' : 'Activité des 30 derniers jours'}</span>
                </div>
                <span className="font-bold text-slate-700">
                  {hoveredDayIndex !== null
                    ? `${thirtyDayHistory[hoveredDayIndex]?.label}: ${
                        thirtyDayHistory[hoveredDayIndex]?.active
                          ? language === 'en'
                            ? '✓ Session completed'
                            : '✓ Séance effectuée'
                          : language === 'en'
                          ? 'No session'
                          : 'Aucune séance'
                      }`
                    : `${lastSubmissionDate !== '—' ? (language === 'en' ? `Last session: ${lastSubmissionDate}` : `Dernière: ${lastSubmissionDate}`) : (language === 'en' ? 'No session yet' : 'Aucune séance')}`}
                </span>
              </div>

              {/* 3D Inset Activity Channel */}
              <div className="bg-[#e8edf5] shadow-[inset_3px_3px_7px_#c2cee0,inset_-3px_-3px_7px_#ffffff] rounded-2xl p-2.5 sm:p-3 border border-white/60">
                <div className="grid grid-cols-30 gap-1 h-7 items-end" style={{ gridTemplateColumns: 'repeat(30, minmax(0, 1fr))' }}>
                  {thirtyDayHistory.map((item, idx) => (
                    <div
                      key={item.dateKey}
                      onMouseEnter={() => setHoveredDayIndex(idx)}
                      onMouseLeave={() => setHoveredDayIndex(null)}
                      className={`rounded-sm transition-all cursor-pointer ${
                        item.active
                          ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 h-6 shadow-[2px_2px_4px_rgba(5,150,105,0.4),-1px_-1px_3px_rgba(255,255,255,0.8)] scale-y-105'
                          : 'bg-[#d8e2ee] shadow-[inset_1px_1px_2px_#c2cee0] h-2 hover:bg-[#cbd9eb]'
                      }`}
                      title={`${item.label}: ${item.active ? '1 session' : '0'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </BentoTile>

        {/* ======================================================== */}
        {/* TILE 2: 3D SPEEDOMETER GAUGE TILE (1 Column on lg)       */}
        {/* Colors 0-20: Red -> Orange -> LightGreen -> Green        */}
        {/* ======================================================== */}
        <BentoTile
          className="col-span-1"
          title={
            <div className="px-3.5 py-1.5 rounded-full bg-[#e8edf5] shadow-[2px_2px_5px_#c2cee0,-2px_-2px_5px_#ffffff] border border-white/85 inline-flex items-center gap-2">
              <Gauge className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-[11px] sm:text-xs font-black text-slate-700 uppercase tracking-wider">
                {language === 'en' ? 'Average & Goal' : 'Moyenne & Cible'}
              </span>
            </div>
          }
          action={
            <span className="text-[10px] font-black px-3 py-1 rounded-full bg-[#e8edf5] shadow-[2px_2px_5px_#c2cee0,-2px_-2px_5px_#ffffff] text-blue-700 border border-white/85 inline-flex items-center gap-1">
              🎯 {targetGoal}
            </span>
          }
        >
          <div className="flex flex-col items-center justify-between h-full space-y-3 py-1">
            {/* 3D Neomorphic SVG Speedometer Dial */}
            <div className="flex flex-col items-center justify-center my-auto w-full">
              <svg viewBox="0 0 160 88" className="w-full max-w-[168px] overflow-visible select-none">
                <defs>
                  {/* User requirement: 10 is green and goes 10+ in meter green goes darker, before 10 red & orange shades */}
                  <linearGradient id="speedo3dGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ef4444" />   {/* 0/20: Red */}
                    <stop offset="25%" stopColor="#f97316" />  {/* ~5/20: Orange */}
                    <stop offset="42%" stopColor="#84cc16" />  {/* ~8/20: Light Green / Lime */}
                    <stop offset="50%" stopColor="#10b981" />  {/* 10/20: Green (Passing B2 threshold) */}
                    <stop offset="72%" stopColor="#059669" />  {/* ~14/20: Darker Green */}
                    <stop offset="100%" stopColor="#047857" /> {/* 20/20: Deep Forest Green */}
                  </linearGradient>

                  {/* 3D Shadow for needle */}
                  <filter id="needle3dShadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="2" dy="3" stdDeviation="2" floodColor="#0f172a" floodOpacity="0.38" />
                  </filter>

                  {/* 3D Soft glow for active arc */}
                  <filter id="arcGlow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#059669" floodOpacity="0.25" />
                  </filter>

                  {/* 3D Metallic Hub Gradient */}
                  <radialGradient id="hub3dGrad" cx="38%" cy="32%" r="65%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="45%" stopColor="#d6e0ee" />
                    <stop offset="85%" stopColor="#9fb3cc" />
                    <stop offset="100%" stopColor="#64748b" />
                  </radialGradient>
                </defs>

                {/* --- 3D RECESSED NEUMORPHIC GROOVE --- */}
                {/* 1. Recessed bottom highlight arc */}
                <path
                  d="M 24 75 A 56 56 0 0 1 136 75"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="13"
                  strokeLinecap="round"
                  opacity="0.95"
                />
                {/* 2. Recessed top dark shadow arc */}
                <path
                  d="M 24 73 A 56 56 0 0 1 136 73"
                  fill="none"
                  stroke="#b6c5d8"
                  strokeWidth="13"
                  strokeLinecap="round"
                />
                {/* 3. Recessed trough floor */}
                <path
                  d="M 24 74 A 56 56 0 0 1 136 74"
                  fill="none"
                  stroke="#d7e1ee"
                  strokeWidth="11"
                  strokeLinecap="round"
                />
                {/* 4. Inner groove deep shade */}
                <path
                  d="M 24 73.5 A 56 56 0 0 1 136 73.5"
                  fill="none"
                  stroke="#c3d2e5"
                  strokeWidth="9"
                  strokeLinecap="round"
                  opacity="0.65"
                />

                {/* --- 3D ACTIVE VALUE ARC (Red -> Orange -> LightGreen -> Green) --- */}
                <path
                  d="M 24 74 A 56 56 0 0 1 136 74"
                  fill="none"
                  stroke="url(#speedo3dGrad)"
                  strokeWidth="11"
                  strokeLinecap="round"
                  strokeDasharray={arcLength}
                  strokeDashoffset={strokeDashoffset}
                  filter="url(#arcGlow)"
                  className="transition-all duration-700 ease-out"
                />

                {/* Tactile tick markers at 0, 5, 10, 15, 20 */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                  const ang = Math.PI * (1 - pct);
                  const x1 = centerX + Math.cos(ang) * 46;
                  const y1 = centerY - Math.sin(ang) * 46;
                  const x2 = centerX + Math.cos(ang) * 42;
                  const y2 = centerY - Math.sin(ang) * 42;
                  return (
                    <line
                      key={i}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#94a3b8"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                    />
                  );
                })}

                {/* Scale labels */}
                <text x="21" y="87" fontSize="8.5" fontWeight="900" fill="#ef4444" textAnchor="middle">0</text>
                <text x="80" y="24" fontSize="9" fontWeight="900" fill="#10b981" textAnchor="middle">10</text>
                <text x="139" y="87" fontSize="8.5" fontWeight="900" fill="#047857" textAnchor="middle">20</text>

                {/* --- 3D NEEDLE POINTER --- */}
                <g filter="url(#needle3dShadow)" className="transition-all duration-700 ease-out">
                  {/* Needle stem */}
                  <line
                    x1={centerX}
                    y1={centerY}
                    x2={needleX}
                    y2={needleY}
                    stroke="#1e293b"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                  {/* Specular highlight edge on needle */}
                  <line
                    x1={centerX}
                    y1={centerY}
                    x2={needleX}
                    y2={needleY}
                    stroke="#64748b"
                    strokeWidth="1"
                    strokeLinecap="round"
                    opacity="0.8"
                  />
                </g>

                {/* --- 3D CENTER METALLIC PIVOT HUB --- */}
                {/* Outer shadow ring */}
                <circle cx={centerX} cy={centerY} r="8.5" fill="#b0c0d5" />
                {/* Outer highlight ring */}
                <circle cx={centerX} cy={centerY - 0.5} r="8" fill="#ffffff" />
                {/* Hub body */}
                <circle cx={centerX} cy={centerY} r="6.5" fill="url(#hub3dGrad)" />
                {/* Center jewel */}
                <circle cx={centerX - 0.5} cy={centerY - 0.5} r="3" fill="#2563eb" />
                {/* Specular glint */}
                <circle cx={centerX - 1.2} cy={centerY - 1.2} r="1" fill="#ffffff" />
              </svg>

              {/* 3D Recessed Well Score Display */}
              <div className="mt-1 px-4 py-1.5 rounded-full bg-[#e8edf5] shadow-[inset_3px_3px_6px_#c2cee0,inset_-3px_-3px_6px_#ffffff] border border-white/60 flex items-baseline justify-center gap-1.5">
                <span className="text-3xl font-black text-slate-900 tracking-tight leading-none">
                  {perfStats.avgScore}
                </span>
                <span className="text-xs font-bold text-slate-400">/ 20</span>
                {perfStats.avgScore > 0 && (
                  <span className="ml-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[2px_2px_5px_rgba(37,99,235,0.4),-1px_-1px_3px_rgba(255,255,255,0.8)]">
                    {perfStats.avgCefr}
                  </span>
                )}
              </div>
            </div>

            <div className="w-full pt-2 border-t border-slate-200/50 text-center">
              <p className="text-[11px] font-bold text-slate-500 truncate">
                {perfStats.bestScore > 0
                  ? language === 'en'
                    ? `Best: ${perfStats.bestScore}/20 (${perfStats.bestCefr})`
                    : `Meilleur : ${perfStats.bestScore}/20 (${perfStats.bestCefr})`
                  : language === 'en'
                  ? `Goal: ${targetGoal}`
                  : `Objectif : ${targetGoal}`}
              </p>
            </div>
          </div>
        </BentoTile>

        {/* ======================================================== */}
        {/* TILE 3: MISTAKES ALLOCATION TILE (1 Column on lg)        */}
        {/* Distribution of Mistakes Across Categories               */}
        {/* ======================================================== */}
        <BentoTile
          className="col-span-1"
          title={
            <div className="px-3.5 py-1.5 rounded-full bg-[#e8edf5] shadow-[2px_2px_5px_#c2cee0,-2px_-2px_5px_#ffffff] border border-white/85 inline-flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[11px] sm:text-xs font-black text-slate-700 uppercase tracking-wider">
                {language === 'en' ? 'Mistakes Bank' : 'Banque d’erreurs'}
              </span>
            </div>
          }
          action={
            <button
              type="button"
              onClick={() => (onNavigateToSubmissions ? onNavigateToSubmissions('mistakes') : onSwitchTab('mistakes'))}
              className="text-[10px] font-bold text-amber-800 bg-[#e8edf5] shadow-[2px_2px_5px_#c2cee0,-2px_-2px_5px_#ffffff] px-3 py-1 rounded-full border border-white/85 flex items-center gap-1.5 transition-all hover:shadow-[1px_1px_3px_#c2cee0,-1px_-1px_3px_#ffffff] cursor-pointer"
            >
              <span>{mistakes.length}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          }
        >
          <div className="flex flex-col justify-between h-full space-y-3">
            {/* 3D Segmented Bar with Inset Groove */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span className="font-semibold">{language === 'en' ? 'Category breakdown' : 'Répartition'}</span>
                <span className="font-bold text-slate-700">{mistakes.length} {language === 'en' ? 'items' : 'fautes'}</span>
              </div>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#e8edf5] shadow-[inset_2px_2px_5px_#c2cee0,inset_-2px_-2px_5px_#ffffff] p-0.5 border border-white/60">
                {mistakeCategoriesCount.map((cat) => (
                  <div
                    key={cat.name}
                    className={`h-full ${cat.colors.bar} first:rounded-l-full last:rounded-r-full shadow-xs`}
                    style={{ width: `${cat.pct}%` }}
                    title={`${cat.name}: ${cat.count} (${cat.pct}%)`}
                  />
                ))}
              </div>
            </div>

            {/* Tactile Category Cards */}
            <div className="space-y-2 my-auto">
              {mistakeCategoriesCount.length > 0 ? (
                mistakeCategoriesCount.slice(0, 3).map((cat) => (
                  <div
                    key={cat.name}
                    className="flex items-center justify-between text-xs py-1.5 px-3 rounded-2xl bg-[#e8edf5] shadow-[3px_3px_7px_#c2cee0,-3px_-3px_7px_#ffffff] border border-white/80"
                  >
                    <span className="font-bold text-slate-700 truncate pr-2 text-[11px]">{cat.name}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black shrink-0 ${cat.colors.bg} shadow-2xs`}>
                      {cat.count}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 text-center py-4">
                  {language === 'en' ? 'No mistakes recorded yet.' : 'Aucune erreur enregistrée.'}
                </p>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200/50">
              <button
                type="button"
                onClick={() => (onNavigateToSubmissions ? onNavigateToSubmissions('mistakes') : onSwitchTab('mistakes'))}
                className="w-full py-2.5 rounded-full bg-[#e8edf5] shadow-[3px_3px_7px_#c2cee0,-3px_-3px_7px_#ffffff] hover:shadow-[1px_1px_3px_#c2cee0,-1px_-1px_3px_#ffffff] active:shadow-[inset_2px_2px_4px_#c2cee0,inset_-2px_-2px_4px_#ffffff] text-center text-[11px] font-bold text-indigo-700 border border-white/70 transition-all cursor-pointer"
              >
                {language === 'en' ? 'Open Mistakes Bank →' : 'Consulter mes erreurs →'}
              </button>
            </div>
          </div>
        </BentoTile>

        {/* ======================================================== */}
        {/* TILE 4: 3D PRACTICE CALENDAR (Spans 2 columns on lg)      */}
        {/* Fixed 42-cell layout with stable month switcher & 3D keys*/}
        {/* ======================================================== */}
        <BentoTile
          className="sm:col-span-2 lg:col-span-2"
          title={
            <div className="px-3.5 py-1.5 rounded-full bg-[#e8edf5] shadow-[2px_2px_5px_#c2cee0,-2px_-2px_5px_#ffffff] border border-white/85 inline-flex items-center gap-2">
              <CalendarIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[11px] sm:text-xs font-black text-slate-700 uppercase tracking-wider">
                {language === 'en' ? 'Practice Calendar' : 'Calendrier de Pratique'}
              </span>
              <span className="ml-1 text-[10px] font-black text-emerald-700 bg-[#e8edf5] shadow-[inset_1px_1px_3px_#c2cee0,inset_-1px_-1px_3px_#ffffff] px-2.5 py-0.5 rounded-full border border-white/70">
                ✓ {calendarGrid.practicedInMonth} {calendarGrid.practicedInMonth > 1 ? (language === 'en' ? 'sessions' : 'séances') : (language === 'en' ? 'session' : 'séance')}
              </span>
            </div>
          }
          action={
            /* Stable, fixed size Month Switcher Container with rounded-full shape */
            <div className="flex items-center justify-between w-[185px] sm:w-[200px] bg-[#e8edf5] shadow-[inset_2px_2px_5px_#c2cee0,inset_-2px_-2px_5px_#ffffff] p-1 rounded-full border border-white/70 shrink-0">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-7 h-7 flex items-center justify-center bg-[#e8edf5] shadow-[2px_2px_5px_#c2cee0,-2px_-2px_5px_#ffffff] hover:shadow-[1px_1px_3px_#c2cee0,-1px_-1px_3px_#ffffff] active:shadow-[inset_2px_2px_4px_#c2cee0,inset_-2px_-2px_4px_#ffffff] rounded-full border border-white/80 text-slate-700 transition-all cursor-pointer shrink-0"
                title={language === 'en' ? 'Previous month' : 'Mois précédent'}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="flex-1 text-center text-xs font-black text-slate-800 capitalize px-2 select-none truncate">
                {calendarGrid.monthLabel}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="w-7 h-7 flex items-center justify-center bg-[#e8edf5] shadow-[2px_2px_5px_#c2cee0,-2px_-2px_5px_#ffffff] hover:shadow-[1px_1px_3px_#c2cee0,-1px_-1px_3px_#ffffff] active:shadow-[inset_2px_2px_4px_#c2cee0,inset_-2px_-2px_4px_#ffffff] rounded-full border border-white/80 text-slate-700 transition-all cursor-pointer shrink-0"
                title={language === 'en' ? 'Next month' : 'Mois suivant'}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          }
        >
          <div className="flex flex-col justify-between h-full space-y-3">
            {/* Weekday Row */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center font-extrabold text-[11px] text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-200/50">
              {weekDays.map((wd) => (
                <div key={wd} className="truncate">
                  {wd}
                </div>
              ))}
            </div>

            {/* Days Grid: Fixed 42 Cells (6 rows * 7 days) with 3D tactile keys */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5 my-auto">
              {calendarGrid.days.map((item) => {
                if (item.day === null) {
                  return <div key={item.key} className="h-8 sm:h-9 pointer-events-none" />;
                }
                return (
                  <div
                    key={item.key}
                    className={`h-8 sm:h-9 max-w-[42px] w-full mx-auto rounded-xl flex items-center justify-center text-xs sm:text-[13px] font-bold transition-all relative ${
                      item.isPracticed
                        ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-black shadow-[3px_3px_8px_rgba(5,150,105,0.45),-2px_-2px_6px_rgba(255,255,255,0.9)] border border-emerald-300/80 scale-[1.08]'
                        : item.isToday
                        ? 'bg-[#e8edf5] shadow-[inset_2px_2px_4px_#c2cee0,inset_-2px_-2px_4px_#ffffff] ring-2 ring-blue-500 text-blue-700 font-black'
                        : 'bg-[#e8edf5] shadow-[2px_2px_5px_#c2cee0,-2px_-2px_5px_#ffffff] hover:shadow-[1px_1px_3px_#c2cee0,-1px_-1px_3px_#ffffff] border border-white/80 text-slate-700 hover:text-blue-600'
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
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-200 rounded-full ring-1 ring-white shadow-xs" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer Legend */}
            <div className="pt-2.5 border-t border-slate-200/50 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block shadow-xs" />
                  <span className="font-bold text-slate-700">{language === 'en' ? 'Practiced' : 'Pratiqué'}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full ring-2 ring-blue-500 bg-blue-50 inline-block" />
                  <span className="font-semibold text-slate-600">{language === 'en' ? 'Today' : "Aujourd'hui"}</span>
                </span>
              </div>
              <span className="font-black text-emerald-700">
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
                  : 'Aucune session'}
              </span>
            </div>
          </div>
        </BentoTile>

        {/* ======================================================== */}
        {/* TILE 5: MY PAST SUBMISSIONS (Spans 2 columns on lg)       */}
        {/* Shows at least 5 lists with 3D tactile elevation cards   */}
        {/* ======================================================== */}
        <BentoTile
          className="sm:col-span-2 lg:col-span-2"
          title={
            <div className="px-3.5 py-1.5 rounded-full bg-[#e8edf5] shadow-[2px_2px_5px_#c2cee0,-2px_-2px_5px_#ffffff] border border-white/85 inline-flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-[11px] sm:text-xs font-black text-slate-700 uppercase tracking-wider">
                {language === 'en' ? 'My Past Submissions' : 'Mes Soumissions Passées'}
              </span>
              <span className="ml-1 text-[10px] font-black text-blue-700 bg-[#e8edf5] shadow-[inset_1px_1px_3px_#c2cee0,inset_-1px_-1px_3px_#ffffff] px-2 py-0.5 rounded-full border border-white/70">
                {submissions.length}
              </span>
            </div>
          }
          action={
            <button
              type="button"
              onClick={() => (onNavigateToSubmissions ? onNavigateToSubmissions('exams') : onSwitchTab('submissions'))}
              className="text-[11px] font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1.5 bg-[#e8edf5] shadow-[2px_2px_5px_#c2cee0,-2px_-2px_5px_#ffffff] px-3.5 py-1.5 rounded-full border border-white/85 transition-all hover:shadow-[1px_1px_3px_#c2cee0,-1px_-1px_3px_#ffffff] cursor-pointer"
            >
              <span>{language === 'en' ? 'View all' : 'Voir tout'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          }
        >
          <div className="flex flex-col justify-between min-h-0 space-y-3">
            {submissions.length > 0 ? (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {submissions.slice(0, 5).map((sub, idx) => {
                  const score = sub.aiEvaluation?.overall_score;
                  const cefr = sub.aiEvaluation?.estimated_cefr_level;
                  const combo = sub.combination?.combinationNumber || sub.combination?.combination || (idx + 1);

                  return (
                    <div
                      key={sub.id || idx}
                      onClick={() => onViewSubmission(sub)}
                      className="p-3 rounded-2xl bg-[#e8edf5] shadow-[4px_4px_10px_#c2cee0,-4px_-4px_10px_#ffffff] hover:shadow-[2px_2px_6px_#c2cee0,-2px_-2px_6px_#ffffff] active:shadow-[inset_2px_2px_4px_#c2cee0,inset_-2px_-2px_4px_#ffffff] border border-white/80 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* 3D recessed number circle */}
                        <div className="w-9 h-9 rounded-xl bg-[#e8edf5] shadow-[inset_2px_2px_4px_#c2cee0,inset_-2px_-2px_4px_#ffffff] border border-white/60 flex items-center justify-center font-black text-xs text-slate-700 shrink-0 group-hover:text-blue-600 transition-colors">
                          #{combo}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-800 truncate">
                            {sub.month} {sub.year} — Combinaison {combo}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate mt-0.5 font-medium">
                            {sub.date ? sub.date.split(' à ')[0] : '—'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        {typeof score === 'number' ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-slate-900 bg-[#e8edf5] shadow-[2px_2px_5px_#c2cee0,-2px_-2px_5px_#ffffff] px-2.5 py-1 rounded-full border border-white/80">
                              {Math.round(score)}/20
                            </span>
                            {cefr && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-100 text-indigo-700 shadow-2xs">
                                {cefr}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-800 bg-[#e8edf5] shadow-[inset_1px_1px_3px_#c2cee0,inset_-1px_-1px_3px_#ffffff] px-2.5 py-1 rounded-full">
                            {language === 'en' ? 'Pending' : 'Non évalué'}
                          </span>
                        )}
                        <div className="w-7 h-7 rounded-full bg-[#e8edf5] shadow-[2px_2px_4px_#c2cee0,-2px_-2px_4px_#ffffff] flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:shadow-[1px_1px_3px_#c2cee0,-1px_-1px_3px_#ffffff] transition-all">
                          <Eye className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 space-y-2">
                <p className="text-xs">{language === 'en' ? 'No exam submissions yet.' : 'Aucun examen soumis pour le moment.'}</p>
                <button
                  type="button"
                  onClick={onStartNewExam}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{language === 'en' ? 'Start your first exam' : 'Commencer votre premier examen'}</span>
                </button>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200/50 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>{evaluatedSubmissions} {language === 'en' ? 'evaluations completed' : 'évaluations terminées'}</span>
              </span>
              <button
                type="button"
                onClick={() => (onNavigateToSubmissions ? onNavigateToSubmissions('exams') : onSwitchTab('submissions'))}
                className="font-bold text-blue-600 hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>{language === 'en' ? 'My exams & mistakes →' : 'Mes examens & erreurs →'}</span>
              </button>
            </div>
          </div>
        </BentoTile>
      </div>
    </div>
  );
};
