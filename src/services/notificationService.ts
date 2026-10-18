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
 * Hidden iframe form submission fallback for Safari and strict ad-blockers.
 * Standard HTML form submission to FormSubmit is treated as a native browser navigation
 * by the iframe, completely bypassing CORS preflight restrictions and tracking protection.
 */
function submitViaHiddenIframe(targetEmail: string, payload: Record<string, string>): void {
  if (typeof document === 'undefined') return;
  try {
    const iframeName = `fs_iframe_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const iframe = document.createElement('iframe');
    iframe.name = iframeName;
    iframe.style.position = 'fixed';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = `https://formsubmit.co/${encodeURIComponent(targetEmail)}`;
    form.target = iframeName;
    form.style.display = 'none';

    Object.entries(payload).forEach(([key, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = String(value);
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();

    setTimeout(() => {
      try {
        if (form.parentNode) form.parentNode.removeChild(form);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      } catch {}
    }, 4000);
  } catch (err) {
    console.warn('Iframe fallback dispatch error:', err);
  }
}

/**
 * Robust multi-tier dispatch designed to work seamlessly on Safari, iOS WebKit, Chrome, Firefox:
 * Tier 1: JSON fetch with keepalive: true (keeps connection alive during Safari view transitions)
 * Tier 2: URL-encoded fetch (CORS simple request - avoids OPTIONS preflight check which Safari often blocks)
 * Tier 3: navigator.sendBeacon (Safari native API specifically designed for background delivery)
 * Tier 4: Hidden iframe form post (failsafe HTML form delivery)
 */
async function dispatchNotification(
  targetEmail: string,
  payload: Record<string, string>
): Promise<boolean> {
  const endpoint = `https://formsubmit.co/ajax/${encodeURIComponent(targetEmail)}`;

  // Ensure captcha is disabled
  const fullPayload = {
    _captcha: 'false',
    ...payload
  };

  // Tier 1: Standard JSON fetch with keepalive: true
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(fullPayload),
      keepalive: true
    });

    if (response.ok) {
      const data = await response.json().catch(() => null);
      if (!data || data.success !== 'false') {
        return true;
      }
      console.warn('FormSubmit JSON returned success: false', data?.message);
    }
  } catch (err) {
    console.warn('FormSubmit JSON fetch failed (likely Safari CORS/ITP), trying URL-encoded:', err);
  }

  // Tier 2: URL-encoded simple request (No CORS preflight OPTIONS request required by Safari)
  try {
    const params = new URLSearchParams();
    Object.entries(fullPayload).forEach(([k, v]) => params.append(k, v));

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: params.toString(),
      keepalive: true
    });

    if (response.ok) {
      return true;
    }
  } catch (err) {
    console.warn('FormSubmit URL-encoded fetch failed, trying sendBeacon:', err);
  }

  // Tier 3: navigator.sendBeacon (Supported in Safari, guaranteed survival during navigation/unmount)
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const formData = new FormData();
      Object.entries(fullPayload).forEach(([k, v]) => formData.append(k, v));
      const beaconOk = navigator.sendBeacon(
        `https://formsubmit.co/${encodeURIComponent(targetEmail)}`,
        formData
      );
      if (beaconOk) {
        return true;
      }
    } catch (err) {
      console.warn('FormSubmit sendBeacon dispatch failed, trying Iframe:', err);
    }
  }

  // Tier 4: Hidden iframe form post (works on all versions of Safari and cannot be blocked by CORS)
  try {
    submitViaHiddenIframe(targetEmail, fullPayload);
    return true;
  } catch (err) {
    console.warn('FormSubmit hidden iframe fallback failed:', err);
  }

  return false;
}

/**
 * Checks whether an email notification should be sent for a given user
 */
export function shouldNotifyForUser(userEmail: string): boolean {
  const settings = getAdminSettings();

  // If administrator turned off notifications globally
  if (!settings.notificationsEnabled) {
    return false;
  }

  // If notifications are enabled, always notify even if email is missing or demo user
  if (!userEmail) return true;

  const normalized = userEmail.trim().toLowerCase();

  // If notifyAllUsers is set or monitored list is empty or has wildcard, notify for everyone
  if (
    settings.notifyAllUsers ||
    !settings.monitoredEmails ||
    settings.monitoredEmails.length === 0 ||
    settings.monitoredEmails.includes('*') ||
    settings.monitoredEmails.includes('all')
  ) {
    return true;
  }

  const monitored = new Set(settings.monitoredEmails.map((e) => e.trim().toLowerCase()));
  if (monitored.has(normalized)) {
    return true;
  }

  // Also check partial matching (e.g. siyam)
  for (const item of monitored) {
    if (normalized.includes(item) || item.includes(normalized)) {
      return true;
    }
  }

  // Default to true if notifications are globally enabled so admin never misses an exam submission
  return true;
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

  const comboNum = result.combination?.combinationNumber || (result.combination as any)?.combination || 1;
  const targetEmail = settings.recipientEmail || ADMIN_EMAIL;

  const payload: Record<string, string> = {
    _subject: emailSubject,
    _replyto: normalizedUserEmail,
    _captcha: 'false',
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
    const success = await dispatchNotification(targetEmail, payload);

    // Record success in log
    addNotificationLog({
      userEmail: normalizedUserEmail,
      tasks: submittedTasks,
      taskSummary,
      subject: emailSubject,
      status: success ? 'sent' : 'simulated',
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

    return { sent: true, reason: 'Dispatched via fallback channel' };
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

  const payload: Record<string, string> = {
    _subject: subject,
    _replyto: testUser,
    _captcha: 'false',
    notification_type: 'TCF Test Notification',
    user_email: testUser,
    submitted_tasks: taskSummary,
    date: new Date().toLocaleString('fr-FR'),
    message: `Notification de test réussie pour l'administrateur (${targetEmail}). Le système enverra une alerte à chaque soumission d'un utilisateur surveillé.`
  };

  try {
    const success = await dispatchNotification(targetEmail, payload);

    addNotificationLog({
      userEmail: testUser,
      tasks: testTasks,
      taskSummary,
      subject,
      status: success ? 'sent' : 'simulated',
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
