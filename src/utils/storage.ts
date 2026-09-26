import { ExamResult } from '../types/exam';

const STORAGE_KEY = 'tcf_exam_submissions_v1';

export function getStoredSubmissions(): ExamResult[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error reading submissions from localStorage:', e);
    return [];
  }
}

export function saveSubmission(result: ExamResult): ExamResult {
  const submissions = getStoredSubmissions();
  
  const dateFormatted = new Date().toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const newSubmission: ExamResult = {
    ...result,
    id: result.id || `sub_${Date.now()}`,
    date: result.date || dateFormatted
  };

  // Add to beginning of array
  const updated = [newSubmission, ...submissions];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving submission to localStorage:', e);
  }

  return newSubmission;
}

export function clearSubmissions(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Error clearing submissions:', e);
  }
}
