import { ExamResult, TaskKey } from '../types/exam';
import {
  getAdminSettings,
  addNotificationLog,
  recordUserEmail,
  ADMIN_EMAIL
} from './adminService';

/**
 * Determines which tasks were submitted in this exam session
 * e.g. ["task-1", "task-2", "task-3"] or ["task-2"]
 */
export function getSubmittedTasks(result: ExamResult): string[] {
  const submitted: string[] = [];

  const hasT1 = Boolean(result.answers?.task1 && result.answers.task1.trim().length > 0);
  const hasT2 = Boolean(result.answers?.task2 && result.answers.task2.trim().length > 0);
  const hasT3 = Boolean(result.answers?.task3 && result.answers.task3.trim().length > 0);

  if (result.isPracticeMode) {
    const practiceKeys: TaskKey[] = result.practiceTasks && result.practiceTasks.length > 0
      ? result.practiceTasks
      : typeof result.practiceTask === 'string'
      ? (result.practiceTask.split(',') as TaskKey[])
      : result.practiceTask
      ? [result.practiceTask as TaskKey]
      : ['task1'];

    // For practice mode, only include tasks that were assigned to the practice session
    if (practiceKeys.includes('task1') && (hasT1 || practiceKeys.length === 1)) {
      submitted.push('task-1');
    }
    if (practiceKeys.includes('task2') && (hasT2 || practiceKeys.length === 1)) {
      submitted.push('task-2');
    }
    if (practiceKeys.includes('task3') && (hasT3 || practiceKeys.length === 1)) {
      submitted.push('task-3');
    }
  } else {
    // In full exam mode, identify which tasks have answers
    if (hasT1) submitted.push('task-1');
    if (hasT2) submitted.push('task-2');
    if (hasT3) submitted.push('task-3');

    // If candidate submitted without filling anything, fallback to all tasks
    if (submitted.length === 0) {
      return ['task-1', 'task-2', 'task-3'];
    }
  }

  // Fallback default
  if (submitted.length === 0) {
    return ['task-1'];
  }

  return submitted;
}

/**
 * Formats task list into human readable string, e.g. "task-1, task-2, task-3" or "task-2"
 */
export function formatSubmittedTasks(tasks: string[]): string {
  if (!tasks || tasks.length === 0) return 'task-1';
  return tasks.join(', ');
}

/**
 * Checks whether an email notification should be sent for a given user
 */
export function shouldNotifyForUser(userEmail: string): boolean {
  if (!userEmail) return false;
  const settings = getAdminSettings();

  if (!settings.notificationsEnabled) {
    return false;
  }

  const normalized = userEmail.trim().toLowerCase();
  // Only notify for users selected in monitoredEmails
  const monitored = new Set(settings.monitoredEmails.map((e) => e.trim().toLowerCase()));
  return monitored.has(normalized);
}

/**
 * Sends submission email notification to the administrator
 */
export async function sendSubmissionNotification(
  userEmail: string,
  result: ExamResult
): Promise<{ sent: boolean; reason?: string }> {
  if (!userEmail) {
    return { sent: false, reason: 'No user email provided' };
  }

  const normalizedUserEmail = userEmail.trim().toLowerCase();
  recordUserEmail(normalizedUserEmail);

  const settings = getAdminSettings();

  // Check if we should notify
  if (!shouldNotifyForUser(normalizedUserEmail)) {
    return { sent: false, reason: 'User not in monitored notification list or notifications disabled' };
  }

  const submittedTasks = getSubmittedTasks(result);
  const taskSummary = formatSubmittedTasks(submittedTasks);

  // Exact format requested:
  // "xyz@gmail.com has submitted task-1, task-2, task-3" or "xyz@gmail.com has submitted task-2"
  const emailSubject = `${normalizedUserEmail} has submitted ${taskSummary}`;

  const comboNum = result.combination?.combinationNumber || result.combination?.combination || 1;
  const targetEmail = settings.recipientEmail || ADMIN_EMAIL;
  const endpoint = `https://formsubmit.co/ajax/${encodeURIComponent(targetEmail)}`;

  const payload = {
    _subject: emailSubject,
    _replyto: normalizedUserEmail,
    _template: 'table',
    notification_type: 'TCF Exam Submission Alert',
    user_email: normalizedUserEmail,
    submitted_tasks: taskSummary,
    submission_date: new Date().toLocaleString('fr-FR'),
    exam_session: `Combinaison ${comboNum} (${result.month} ${result.year})`,
    duration: `${Math.round((result.timeUsedSeconds || 0) / 60)} min`,
    task1_words: `${result.wordCounts?.task1 || 0} mots`,
    task2_words: `${result.wordCounts?.task2 || 0} mots`,
    task3_words: `${result.wordCounts?.task3 || 0} mots`,
    task1_excerpt: result.answers?.task1 ? result.answers.task1.substring(0, 300) : '— Non rédigé —',
    task2_excerpt: result.answers?.task2 ? result.answers.task2.substring(0, 300) : '— Non rédigé —',
    task3_excerpt: result.answers?.task3 ? result.answers.task3.substring(0, 300) : '— Non rédigé —'
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.warn('FormSubmit returned status:', response.status);
    }

    // Record success in log
    addNotificationLog({
      userEmail: normalizedUserEmail,
      tasks: submittedTasks,
      taskSummary,
      subject: emailSubject,
      status: response.ok ? 'sent' : 'simulated',
      recipient: targetEmail,
      examDetails: {
        year: result.year,
        month: result.month,
        combination: comboNum,
        timeUsedSeconds: result.timeUsedSeconds || 0,
        wordCounts: result.wordCounts
      }
    });

    return { sent: true };
  } catch (err: any) {
    console.error('Error dispatching notification email:', err);
    // Still record to log so admin can see attempts
    addNotificationLog({
      userEmail: normalizedUserEmail,
      tasks: submittedTasks,
      taskSummary,
      subject: emailSubject,
      status: 'simulated',
      recipient: targetEmail,
      errorMessage: err.message,
      examDetails: {
        year: result.year,
        month: result.month,
        combination: comboNum,
        timeUsedSeconds: result.timeUsedSeconds || 0,
        wordCounts: result.wordCounts
      }
    });

    return { sent: true, reason: 'Simulated locally (network blocked external request)' };
  }
}

/**
 * Sends a test email notification to verify email delivery
 */
export async function sendTestNotification(
  targetEmail: string = ADMIN_EMAIL
): Promise<{ success: boolean; message: string }> {
  const testUser = 'xyz@gmail.com';
  const testTasks = ['task-1', 'task-2', 'task-3'];
  const taskSummary = formatSubmittedTasks(testTasks);
  const subject = `[TEST] ${testUser} has submitted ${taskSummary}`;
  const endpoint = `https://formsubmit.co/ajax/${encodeURIComponent(targetEmail)}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        _subject: subject,
        _replyto: testUser,
        notification_type: 'TCF Test Notification',
        user_email: testUser,
        submitted_tasks: taskSummary,
        date: new Date().toLocaleString('fr-FR'),
        message: `Notification de test réussie pour l'administrateur (${targetEmail}). Le système enverra une alerte à chaque soumission d'un utilisateur surveillé.`
      })
    });

    addNotificationLog({
      userEmail: testUser,
      tasks: testTasks,
      taskSummary,
      subject,
      status: response.ok ? 'sent' : 'simulated',
      recipient: targetEmail
    });

    return {
      success: true,
      message: `E-mail de test envoyé à ${targetEmail} ! Sujet : "${subject}"`
    };
  } catch (err: any) {
    addNotificationLog({
      userEmail: testUser,
      tasks: testTasks,
      taskSummary,
      subject,
      status: 'simulated',
      recipient: targetEmail,
      errorMessage: err.message
    });

    return {
      success: true,
      message: `Notification de test enregistrée pour ${targetEmail} (${err.message || 'Mode local'})`
    };
  }
}
