import { createClient } from '@supabase/supabase-js';
import { ExamResult, ExamCombination } from '../types/exam';
import questionsData from '../data/questions.json';
import { getStoredSubmissions, syncStoredSubmissions } from '../utils/storage';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zuctnfowdpndgumumrnx.supabase.co';
const defaultAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1Y3RuZm93ZHBuZGd1bXVtcm54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0MjYxNzEsImV4cCI6MjEwNjAwMjE3MX0.SAAVDWVf9pgLdFLrQOgoF6AueQRMS8bMwJeUXTpz8SA';

export function getSupabaseAnonKey(): string {
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem('tcf_supabase_anon_key');
    if (local && local.trim().length > 0) return local.trim();
  }
  return (import.meta.env.VITE_SUPABASE_ANON_KEY || defaultAnonKey).trim();
}

export function setSupabaseAnonKey(key: string): void {
  if (typeof window !== 'undefined') {
    if (key && key.trim().length > 0) {
      localStorage.setItem('tcf_supabase_anon_key', key.trim());
    } else {
      localStorage.removeItem('tcf_supabase_anon_key');
    }
  }
}

export const isSupabaseConfigured = Boolean(supabaseUrl && getSupabaseAnonKey());

export function getSupabase() {
  const key = getSupabaseAnonKey();
  if (!supabaseUrl || !key) return null;
  return createClient(supabaseUrl, key);
}

export const supabase = getSupabase();

export interface DBSubmission {
  id?: string;
  user_id: string;
  year: string;
  month: string;
  combination: number;
  started_at: string;
  completed_at: string;
  duration_seconds: number;
  task1_answer: string;
  task1_word_count: number;
  task2_answer: string;
  task2_word_count: number;
  task3_answer: string;
  task3_word_count: number;
  created_at?: string;
}

import { getLocalISOString } from '../utils/dateUtils';

/**
 * Saves a completed exam submission to Supabase
 */
export async function saveSubmissionToSupabase(
  userId: string,
  result: ExamResult,
  startedAt?: string,
  userEmail?: string
): Promise<{ data: DBSubmission | null; error: Error | null }> {
  if (!supabase || !isSupabaseConfigured) {
    return { data: null, error: new Error('Supabase configuration missing.') };
  }

  const now = new Date();
  const completedAt = getLocalISOString(now);
  const calculatedStartedAt = startedAt
    ? startedAt
    : getLocalISOString(new Date(now.getTime() - (result.timeUsedSeconds || 0) * 1000));

  const payload: any = {
    user_id: userId,
    year: result.year,
    month: result.month,
    combination: result.combination.combinationNumber || result.combination.combination,
    started_at: calculatedStartedAt,
    completed_at: completedAt,
    duration_seconds: result.timeUsedSeconds,
    task1_answer: result.answers.task1 || '',
    task1_word_count: result.wordCounts.task1 || 0,
    task2_answer: result.answers.task2 || '',
    task2_word_count: result.wordCounts.task2 || 0,
    task3_answer: result.answers.task3 || '',
    task3_word_count: result.wordCounts.task3 || 0
  };

  const emailToSave = userEmail || (result as any).userEmail;
  if (emailToSave) {
    payload.email = emailToSave.trim().toLowerCase();
  }

  // Persist AI evaluation directly if already present on the result object
  if (result.aiEvaluation) {
    payload.ai_feedback = result.aiEvaluation;
  }

  const { data, error } = await supabase
    .from('submissions')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('Error inserting submission into Supabase:', error);
    return { data: null, error: new Error(error.message) };
  }

  // Invalidate client cache on new submission
  invalidateSubmissionsCache();

  return { data, error: null };
}

// In-memory cache to prevent redundant Supabase bandwidth egress on tab/view switches
interface SubmissionsCacheEntry {
  submissions: ExamResult[];
  timestamp: number;
}
const submissionsCache = new Map<string, SubmissionsCacheEntry>();
const SUBMISSIONS_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

export function invalidateSubmissionsCache() {
  submissionsCache.clear();
}

/**
 * Fetches past submissions for the logged in user from Supabase RLS
 */
export async function fetchSubmissionsFromSupabase(
  userId: string,
  userEmail?: string | null,
  forceRefresh: boolean = false
): Promise<{ submissions: ExamResult[]; error: Error | null }> {
  if (!supabase || !isSupabaseConfigured) {
    return { submissions: [], error: new Error('Supabase configuration missing.') };
  }

  const cacheKey = `${userId || ''}_${(userEmail || '').trim().toLowerCase()}`;
  if (!forceRefresh) {
    const cached = submissionsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SUBMISSIONS_CACHE_TTL_MS) {
      return { submissions: cached.submissions, error: null };
    }
  }

  let query = supabase.from('submissions').select('*').order('created_at', { ascending: false });

  if (userId && userEmail) {
    const cleanEmail = userEmail.trim().toLowerCase();
    query = query.or(`user_id.eq.${userId},email.eq.${cleanEmail}`);
  } else if (userId) {
    query = query.eq('user_id', userId);
  } else if (userEmail) {
    query = query.eq('email', userEmail.trim().toLowerCase());
  }

  let data: any[] | null = null;
  let error: any = null;

  try {
    const res = await Promise.race([
      query,
      new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('Supabase fetch timed out after 4000ms')), 4000)
      )
    ]);
    data = res.data;
    error = res.error;
  } catch (err: any) {
    console.warn('Supabase submissions query timed out or failed:', err);
    return { submissions: [], error: err };
  }

  if (error) {
    console.error('Error fetching submissions from Supabase:', error);
    return { submissions: [], error: new Error(error.message) };
  }

  const db = questionsData as any;

  const mappedSubmissions: ExamResult[] = (data || []).map((row: DBSubmission) => {
    // Reconstruct ExamCombination from questionsData if available, or build fallback
    const combosForMonth = (db[row.year] && db[row.year][row.month]) || [];
    const matchedCombo = combosForMonth.find(
      (c: ExamCombination) => (c.combinationNumber || c.combination) === row.combination
    );

    const fallbackCombo: ExamCombination = matchedCombo || {
      combination: row.combination,
      combinationNumber: row.combination,
      tasks: {
        task1: { instruction: "Instruction Tâche 1", minWords: 60, maxWords: 120 },
        task2: { instruction: "Instruction Tâche 2", minWords: 120, maxWords: 150 },
        task3: { instruction: "Instruction Tâche 3", minWords: 120, maxWords: 180 }
      }
    };

    const dateFormatted = new Date(row.completed_at || row.created_at || Date.now()).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return {
      id: row.id,
      date: dateFormatted,
      combination: fallbackCombo,
      year: row.year,
      month: row.month,
      timeUsedSeconds: row.duration_seconds,
      answers: {
        task1: row.task1_answer,
        task2: row.task2_answer,
        task3: row.task3_answer
      },
      wordCounts: {
        task1: row.task1_word_count,
        task2: row.task2_word_count,
        task3: row.task3_word_count
      },
      aiEvaluation: (row as any).ai_feedback || undefined
    };
  });

  // Store in client-side memory cache
  submissionsCache.set(cacheKey, { submissions: mappedSubmissions, timestamp: Date.now() });

  return { submissions: mappedSubmissions, error: null };
}

/**
 * Saves or updates AI evaluation feedback on an existing submission.
 * Updates directly by submission UUID so both candidates and inspecting admins can persist evaluations.
 */
export async function updateSubmissionAiFeedback(
  submissionId: string,
  userId: string,
  aiFeedback: any
): Promise<{ error: Error | null }> {
  if (!supabase || !isSupabaseConfigured || !submissionId) {
    return { error: null };
  }

  try {
    const cleanFeedback = JSON.parse(JSON.stringify(aiFeedback));

    const { error } = await supabase
      .from('submissions')
      .update({ ai_feedback: cleanFeedback })
      .eq('id', submissionId);

    if (error) {
      console.error('Error updating AI feedback in Supabase:', error);
      return { error: new Error(error.message) };
    }

    // Invalidate client cache on evaluation update
    invalidateSubmissionsCache();

    return { error: null };
  } catch (err: any) {
    console.error('Exception updating AI feedback in Supabase:', err);
    return { error: new Error(err.message) };
  }
}

/**
 * Deletes a submission from Supabase by ID for the logged in user
 */
export async function deleteSubmissionFromSupabase(
  id: string,
  userId: string
): Promise<{ error: Error | null }> {
  if (!supabase || !isSupabaseConfigured) {
    return { error: null };
  }

  const { error } = await supabase
    .from('submissions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting submission from Supabase:', error);
    return { error: new Error(error.message) };
  }

  // Invalidate client cache on deletion
  invalidateSubmissionsCache();

  return { error: null };
}

/**
 * Automatically syncs any offline/local submissions in localStorage to the user's Supabase account.
 * This ensures submissions created before logging in or on another browser tab are safely persisted in the cloud.
 */
export async function syncLocalSubmissionsToCloud(
  userId: string,
  userEmail?: string | null
): Promise<{ syncedCount: number; error: Error | null }> {
  if (!supabase || !isSupabaseConfigured || !userId) {
    return { syncedCount: 0, error: null };
  }

  try {
    const local = getStoredSubmissions();
    if (!local || local.length === 0) {
      return { syncedCount: 0, error: null };
    }

    // Fetch existing submissions for this user from Supabase (forced fresh)
    const { submissions: dbSubs, error: fetchErr } = await fetchSubmissionsFromSupabase(userId, userEmail, true);
    if (fetchErr) {
      return { syncedCount: 0, error: fetchErr };
    }

    let syncedCount = 0;
    const updatedLocal = [...local];

    for (let i = 0; i < updatedLocal.length; i++) {
      const sub = updatedLocal[i];
      const comboNum = Number(sub.combination?.combinationNumber ?? sub.combination?.combination ?? 1);

      // Check if this submission already exists in Supabase
      const isAlreadyInDb = dbSubs.some((dbSub) => {
        if (sub.id && dbSub.id === sub.id) return true;
        const dbComboNum = Number(dbSub.combination?.combinationNumber ?? dbSub.combination?.combination ?? 1);
        return (
          String(dbSub.year) === String(sub.year) &&
          String(dbSub.month).toLowerCase() === String(sub.month).toLowerCase() &&
          dbComboNum === comboNum &&
          Math.abs((dbSub.timeUsedSeconds || 0) - (sub.timeUsedSeconds || 0)) < 10
        );
      });

      if (!isAlreadyInDb) {
        const { data, error: insertErr } = await saveSubmissionToSupabase(
          userId,
          sub,
          sub.date,
          userEmail || undefined
        );
        if (!insertErr && data?.id) {
          updatedLocal[i] = {
            ...sub,
            id: data.id
          };
          syncedCount++;
        }
      }
    }

    if (syncedCount > 0) {
      syncStoredSubmissions(updatedLocal);
      invalidateSubmissionsCache();
    }

    return { syncedCount, error: null };
  } catch (err: any) {
    console.error('Error during cloud sync of local submissions:', err);
    return { syncedCount: 0, error: err };
  }
}
