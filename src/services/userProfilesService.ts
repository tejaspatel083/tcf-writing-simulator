import { ExamResult, ExamCombination, TaskKey } from '../types/exam';
import { SavedMistake, CefrLevel, AIEvaluation } from '../types/aiEvaluation';
import { getSupabase } from '../lib/supabase';
import { mapScoreToTcfCanadaLevels, evaluateTcfSubmissionWithGemini } from './geminiEvaluator';
import { normalizeCategory } from '../utils/mistakesStorage';
import { isOwnerEmail, ADMIN_EMAIL } from './adminService';
import questionsData from '../data/questions.json';

export interface CandidateProfile {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  isMonitored: boolean;
  isAdmin?: boolean;
  submissionsCount: number;
  averageScore: number;
  cefrLevel: CefrLevel | '—';
  bestScore: number;
  mistakesCount: number;
  lastActiveDate?: string;
  targetGoal: CefrLevel;
}

export interface CandidateFullData {
  profile: CandidateProfile;
  submissions: ExamResult[];
  mistakes: SavedMistake[];
}

/**
 * Retrieves cached AI evaluation from localStorage if available
 */
function getCachedAiEvaluation(subId: string, comboKey?: string): AIEvaluation | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(`tcf_ai_eval_${subId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  try {
    const localSubsRaw = localStorage.getItem('tcf_exam_submissions_v1');
    if (localSubsRaw) {
      const localSubs: ExamResult[] = JSON.parse(localSubsRaw);
      if (Array.isArray(localSubs)) {
        const idMatch = localSubs.find((s) => s.id === subId);
        if (idMatch?.aiEvaluation) return idMatch.aiEvaluation;
        if (comboKey) {
          const comboMatch = localSubs.find(
            (s) =>
              `${s.year}-${s.month}-${
                s.combination?.combinationNumber || s.combination?.combination || 1
              }` === comboKey
          );
          if (comboMatch?.aiEvaluation) return comboMatch.aiEvaluation;
        }
      }
    }
  } catch {}
  return undefined;
}

/**
 * Maps a raw Supabase submission row into an ExamResult object.
 */
export function mapSupabaseRowToExamResult(row: any): ExamResult {
  const db = questionsData as any;
  const combosForMonth = (db[row.year] && db[row.year][row.month]) || [];
  const matchedCombo = combosForMonth.find(
    (c: any) => (c.combinationNumber || c.combination) === row.combination
  );

  const fallbackCombo: ExamCombination = matchedCombo || {
    combination: row.combination || 1,
    combinationNumber: row.combination || 1,
    tasks: {
      task1: { instruction: "Instruction Tâche 1", minWords: 60, maxWords: 120 },
      task2: { instruction: "Instruction Tâche 2", minWords: 120, maxWords: 150 },
      task3: { instruction: "Instruction Tâche 3", minWords: 120, maxWords: 180 }
    }
  };

  const completedDate = row.completed_at || row.created_at || new Date().toISOString();
  const dateFormatted = new Date(completedDate).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Check if evaluation is attached to row or stored in cache
  const comboKey = `${row.year}-${row.month}-${row.combination}`;
  const aiEval = row.ai_feedback || getCachedAiEvaluation(row.id, comboKey);

  // Detect if this was a practice session (1 or 2 tasks answered instead of all 3)
  const answeredTasks: TaskKey[] = [];
  if (row.task1_answer?.trim() || (Number(row.task1_word_count) > 0)) answeredTasks.push('task1');
  if (row.task2_answer?.trim() || (Number(row.task2_word_count) > 0)) answeredTasks.push('task2');
  if (row.task3_answer?.trim() || (Number(row.task3_word_count) > 0)) answeredTasks.push('task3');
  const isPractice = answeredTasks.length > 0 && answeredTasks.length < 3;

  return {
    id: row.id,
    date: dateFormatted,
    combination: fallbackCombo,
    year: String(row.year || '2026'),
    month: String(row.month || 'Novembre'),
    timeUsedSeconds: Number(row.duration_seconds || 0),
    allocatedMinutes: row.duration_seconds ? Math.max(15, Math.round(row.duration_seconds / 60)) : undefined,
    isPracticeMode: isPractice,
    practiceTasks: isPractice ? answeredTasks : undefined,
    practiceTask: isPractice ? answeredTasks.join(',') : undefined,
    answers: {
      task1: row.task1_answer || '',
      task2: row.task2_answer || '',
      task3: row.task3_answer || ''
    },
    wordCounts: {
      task1: Number(row.task1_word_count || 0),
      task2: Number(row.task2_word_count || 0),
      task3: Number(row.task3_word_count || 0)
    },
    aiEvaluation: aiEval
  };
}

/**
 * Extracts saved mistakes from an array of real ExamResult submissions
 */
export function extractMistakesFromSubmissions(subs: ExamResult[]): SavedMistake[] {
  const mistakes: SavedMistake[] = [];
  subs.forEach((sub, sIdx) => {
    if (sub.aiEvaluation && sub.aiEvaluation.tasks) {
      const taskKeys: TaskKey[] = ['task1', 'task2', 'task3'];
      taskKeys.forEach((tKey) => {
        const taskEval = sub.aiEvaluation?.tasks[tKey];
        if (taskEval && Array.isArray(taskEval.mistakes)) {
          taskEval.mistakes.forEach((m, mIdx) => {
            if (m.original_text || m.corrected_text) {
              mistakes.push({
                id: `mst_${sub.id || sIdx}_${tKey}_${mIdx}`,
                category: normalizeCategory(m.category),
                original_text: m.original_text || '',
                corrected_text: m.corrected_text || '',
                explanation: m.explanation || '',
                task_key: tKey,
                task_name: tKey === 'task1' ? 'Tâche 1' : tKey === 'task2' ? 'Tâche 2' : 'Tâche 3',
                submission_id: sub.id,
                exam_title: `Combinaison ${sub.combination?.combinationNumber || sub.combination?.combination || 1} (${sub.month} ${sub.year})`,
                date: sub.date || '',
                timestamp: Date.now() - sIdx * 86400000
              });
            }
          });
        }
      });
    }
  });
  return mistakes;
}

// In-memory cache for candidate directory to minimize Supabase egress bandwidth
let candidatesDirectoryCache: { data: CandidateProfile[]; timestamp: number } | null = null;
const DIRECTORY_CACHE_TTL_MS = 60 * 1000; // 60 seconds

export function invalidateCandidateDirectoryCache() {
  candidatesDirectoryCache = null;
}

/**
 * Fetches all real candidates and their live submissions from Supabase database.
 * No mock or sample submissions are generated.
 */
export async function getAllCandidatesDirectory(forceRefresh: boolean = false): Promise<CandidateProfile[]> {
  if (!forceRefresh && candidatesDirectoryCache && Date.now() - candidatesDirectoryCache.timestamp < DIRECTORY_CACHE_TTL_MS) {
    return candidatesDirectoryCache.data;
  }

  const client = getSupabase();
  if (!client) return [];

  // Ensure authenticated session so Supabase RLS allows reading submissions
  try {
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData?.session) {
      return [];
    }
  } catch (authErr) {
    console.warn('Supabase auth session sync in getAllCandidatesDirectory:', authErr);
    return [];
  }

  // 1. Fetch real profiles from Supabase public.profiles
  let profilesData: any[] = [];
  try {
    const { data, error } = await client
      .from('profiles')
      .select('id, email, created_at')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      profilesData = data;
    }
  } catch (err) {
    console.warn('Error fetching profiles from Supabase:', err);
  }

  // 2. Fetch submissions metadata from Supabase (exclude full essay texts to cut 80%+ egress bandwidth)
  let submissionsData: any[] = [];
  try {
    const { data, error } = await client
      .from('submissions')
      .select('id, user_id, email, created_at, year, month, combination, duration_seconds, task1_word_count, task2_word_count, task3_word_count, ai_feedback')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      submissionsData = data;
    }
  } catch (err) {
    console.warn('Error fetching submissions from Supabase:', err);
  }

  // Check monitored status from admin settings
  let monitoredSet = new Set<string>();
  try {
    const rawSettings = localStorage.getItem('tcf_admin_notification_settings');
    if (rawSettings) {
      const parsed = JSON.parse(rawSettings);
      if (Array.isArray(parsed.monitoredEmails)) {
        monitoredSet = new Set(parsed.monitoredEmails.map((e: string) => e.toLowerCase().trim()));
      }
    }
  } catch {}

  // 3. Build candidate directory using 100% real live data
  const candidateList: CandidateProfile[] = [];
  const processedEmails = new Set<string>();

  for (const p of profilesData) {
    if (!p.email) continue;

    const cleanEmail = p.email.toLowerCase().trim();
    processedEmails.add(cleanEmail);

    // Find all real live submissions belonging to this candidate
    const userRows = submissionsData.filter(
      (s: any) =>
        (s.user_id && s.user_id === p.id) ||
        (s.email && s.email.toLowerCase().trim() === cleanEmail)
    );

    let userSubs = userRows.map(mapSupabaseRowToExamResult);

    // If this is the admin account, also merge any local submissions stored in browser
    if (isOwnerEmail(cleanEmail) && typeof window !== 'undefined') {
      try {
        const rawLocal = localStorage.getItem('tcf_exam_submissions_v1');
        if (rawLocal) {
          const localSubs: ExamResult[] = JSON.parse(rawLocal);
          if (Array.isArray(localSubs)) {
            const existingKeys = new Set(
              userSubs.map(
                (s) =>
                  `${s.year}-${s.month}-${
                    s.combination?.combinationNumber || s.combination?.combination || 1
                  }`
              )
            );
            for (const lSub of localSubs) {
              const k = `${lSub.year}-${lSub.month}-${
                lSub.combination?.combinationNumber || lSub.combination?.combination || 1
              }`;
              if (!existingKeys.has(k)) {
                userSubs.push(lSub);
                existingKeys.add(k);
              }
            }
          }
        }
      } catch {}
    }

    const userMistakes = extractMistakesFromSubmissions(userSubs);

    // Calculate real stats from real submissions
    let avgScore = 0;
    let bestScore = 0;
    const scores = userSubs
      .map((s) => s.aiEvaluation?.overall_score || 0)
      .filter((s) => s > 0);

    if (scores.length > 0) {
      avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      bestScore = Math.max(...scores);
    }

    const cefr = avgScore > 0 ? mapScoreToTcfCanadaLevels(avgScore).cefr : '—';
    const lastActive = userSubs[0]?.date || (p.created_at ? new Date(p.created_at).toLocaleDateString() : '—');

    candidateList.push({
      id: p.id,
      email: cleanEmail,
      displayName: cleanEmail.split('@')[0],
      createdAt: p.created_at || new Date().toISOString(),
      isMonitored: monitoredSet.has(cleanEmail),
      isAdmin: isOwnerEmail(cleanEmail),
      submissionsCount: userSubs.length,
      averageScore: avgScore,
      cefrLevel: cefr,
      bestScore: bestScore,
      mistakesCount: userMistakes.length,
      lastActiveDate: lastActive,
      targetGoal: 'B2'
    });
  }

  // Also include any submissions that have an email not yet in profiles table
  for (const s of submissionsData) {
    const subEmail = s.email ? s.email.toLowerCase().trim() : '';
    if (subEmail && !processedEmails.has(subEmail)) {
      processedEmails.add(subEmail);
      const userRows = submissionsData.filter(
        (row: any) =>
          (row.user_id && row.user_id === s.user_id) ||
          (row.email && row.email.toLowerCase().trim() === subEmail)
      );
      const userSubs = userRows.map(mapSupabaseRowToExamResult);
      const userMistakes = extractMistakesFromSubmissions(userSubs);
      let avgScore = 0;
      let bestScore = 0;
      const scores = userSubs
        .map((sub) => sub.aiEvaluation?.overall_score || 0)
        .filter((sc) => sc > 0);
      if (scores.length > 0) {
        avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        bestScore = Math.max(...scores);
      }
      const cefr = avgScore > 0 ? mapScoreToTcfCanadaLevels(avgScore).cefr : '—';

      candidateList.push({
        id: s.user_id || 'sub_user_' + Math.random().toString(36).substring(7),
        email: subEmail,
        displayName: subEmail.split('@')[0],
        createdAt: s.created_at || new Date().toISOString(),
        isMonitored: monitoredSet.has(subEmail),
        isAdmin: isOwnerEmail(subEmail),
        submissionsCount: userSubs.length,
        averageScore: avgScore,
        cefrLevel: cefr,
        bestScore: bestScore,
        mistakesCount: userMistakes.length,
        lastActiveDate: userSubs[0]?.date || '—',
        targetGoal: 'B2'
      });
    }
  }

  // Sort: Admin first, then candidates with submissions descending, then alphabetically
  const sorted = candidateList.sort((a, b) => {
    if (a.isAdmin && !b.isAdmin) return -1;
    if (!a.isAdmin && b.isAdmin) return 1;
    return b.submissionsCount - a.submissionsCount || a.email.localeCompare(b.email);
  });
  candidatesDirectoryCache = { data: sorted, timestamp: Date.now() };
  return sorted;
}

/**
 * Returns real live submissions and mistakes for a candidate from Supabase.
 * No mock or sample submissions are generated.
 */
export async function getCandidateSubmissionsAndMistakes(
  email: string,
  userId?: string
): Promise<{ submissions: ExamResult[]; mistakes: SavedMistake[] }> {
  const cleanEmail = email.toLowerCase().trim();
  const client = getSupabase();

  let submissions: ExamResult[] = [];

  if (client) {
    try {
      // Ensure authenticated session
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData?.session) {
        return { submissions: [], mistakes: [] };
      }

      let query = client.from('submissions').select('*').order('created_at', { ascending: false });

      if (userId) {
        query = query.or(`user_id.eq.${userId},email.eq.${cleanEmail}`);
      } else {
        query = query.eq('email', cleanEmail);
      }

      const { data, error } = await query;

      if (!error && Array.isArray(data) && data.length > 0) {
        submissions = data.map(mapSupabaseRowToExamResult);
      }
    } catch (err) {
      console.warn('Error querying candidate submissions from Supabase:', err);
    }
  }

  // If this candidate is the admin or user currently browsing, merge with local submissions
  if (isOwnerEmail(cleanEmail) && typeof window !== 'undefined') {
    try {
      const rawLocal = localStorage.getItem('tcf_exam_submissions_v1');
      if (rawLocal) {
        const localSubs: ExamResult[] = JSON.parse(rawLocal);
        if (Array.isArray(localSubs)) {
          const existingKeys = new Set(
            submissions.map(
              (s) =>
                `${s.year}-${s.month}-${
                  s.combination?.combinationNumber || s.combination?.combination || 1
                }`
            )
          );
          for (const lSub of localSubs) {
            const k = `${lSub.year}-${lSub.month}-${
              lSub.combination?.combinationNumber || lSub.combination?.combination || 1
            }`;
            if (!existingKeys.has(k)) {
              submissions.push(lSub);
              existingKeys.add(k);
            }
          }
        }
      }
    } catch {}
  }

  const mistakes = extractMistakesFromSubmissions(submissions);
  return { submissions, mistakes };
}

/**
 * Pushes any locally stored AI evaluations from the current browser into Supabase submissions.
 * Matches rows by submission ID or by combination/month/year.
 */
export async function pushLocalEvaluationsToSupabase(): Promise<{ pushedCount: number; error?: string }> {
  if (typeof window === 'undefined') return { pushedCount: 0 };
  const client = getSupabase();
  if (!client) return { pushedCount: 0, error: 'No supabase client' };

  try {
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData?.session) {
      return { pushedCount: 0 };
    }

    let pushed = 0;
    // 1. Gather all local evaluations from tcf_exam_submissions_v1
    const localRaw = localStorage.getItem('tcf_exam_submissions_v1');
    const localSubs: ExamResult[] = localRaw ? JSON.parse(localRaw) : [];

    // 2. Also gather any standalone tcf_ai_eval_* keys
    const standaloneEvals: Record<string, AIEvaluation> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('tcf_ai_eval_')) {
        const id = k.replace('tcf_ai_eval_', '');
        try {
          const val = JSON.parse(localStorage.getItem(k) || '');
          if (val && val.overall_score !== undefined) {
            standaloneEvals[id] = val;
          }
        } catch {}
      }
    }

    // Merge evaluations into a map
    const evalMap = new Map<string, { eval: AIEvaluation; sub?: ExamResult }>();
    localSubs.forEach((s) => {
      if (s.aiEvaluation && s.aiEvaluation.overall_score !== undefined) {
        if (s.id) evalMap.set(s.id, { eval: s.aiEvaluation, sub: s });
      }
    });
    Object.entries(standaloneEvals).forEach(([id, ev]) => {
      if (!evalMap.has(id)) {
        evalMap.set(id, { eval: ev });
      }
    });

    if (evalMap.size === 0) {
      return { pushedCount: 0 };
    }

    // Query only submissions from Supabase that actually lack ai_feedback, selecting minimal columns to cut egress bandwidth
    const { data: existingRows } = await client
      .from('submissions')
      .select('id, year, month, combination')
      .is('ai_feedback', null);

    if (Array.isArray(existingRows) && existingRows.length > 0) {
      for (const [keyId, item] of evalMap.entries()) {
        // Try match by UUID id
        const directMatch = existingRows.find((r) => r.id === keyId);
        if (directMatch) {
          const { error: updErr } = await client
            .from('submissions')
            .update({ ai_feedback: item.eval })
            .eq('id', keyId);
          if (!updErr) pushed++;
          continue;
        }

        // Try match by year, month, combination
        if (item.sub) {
          const comboNum = Number(item.sub.combination?.combinationNumber || item.sub.combination?.combination || 1);
          const comboMatch = existingRows.find(
            (r) =>
              String(r.year) === String(item.sub?.year) &&
              String(r.month).toLowerCase() === String(item.sub?.month).toLowerCase() &&
              Number(r.combination) === comboNum
          );
          if (comboMatch) {
            const { error: updErr } = await client
              .from('submissions')
              .update({ ai_feedback: item.eval })
              .eq('id', comboMatch.id);
            if (!updErr) pushed++;
          }
        }
      }
    }

    return { pushedCount: pushed };
  } catch (err: any) {
    console.error('Error pushing local evaluations to Supabase:', err);
    return { pushedCount: 0, error: err?.message };
  }
}

/**
 * Evaluates a candidate submission using Gemini and saves the evaluation directly to Supabase.
 */
export async function evaluateAndSaveCandidateSubmission(
  sub: ExamResult
): Promise<AIEvaluation> {
  const evalData = await evaluateTcfSubmissionWithGemini(sub);

  // Update in Supabase
  if (sub.id) {
    const client = getSupabase();
    if (client) {
      try {
        const { data: sessionData } = await client.auth.getSession();
        if (sessionData?.session) {
          await client
            .from('submissions')
            .update({ ai_feedback: evalData })
            .eq('id', sub.id);
        }
      } catch (dbErr) {
        console.warn('Could not persist evaluation to Supabase:', dbErr);
      }
    }

    // Cache locally as well
    try {
      localStorage.setItem(`tcf_ai_eval_${sub.id}`, JSON.stringify(evalData));
    } catch {}
  }

  return evalData;
}
