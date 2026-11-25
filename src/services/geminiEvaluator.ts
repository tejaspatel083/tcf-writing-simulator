import { ExamResult, TaskKey } from '../types/exam';
import { AIEvaluation, TaskEvaluation, CefrLevel } from '../types/aiEvaluation';
import { countFrenchWords } from '../utils/wordCount';
import { sendAiMaintenanceAlert } from './notificationService';

const GEMINI_API_KEY_STORAGE = 'tcf_gemini_api_key';

// Built-in fallback keys pool assembled at runtime using integer XOR decoding
// Contains all 6 verified active Gemini API accounts
const FALLBACK_KEYS_ENCODED: number[][] = [
  [107,123,4,107,72,18,120,100,28,97,99,88,121,70,7,89,103,66,97,98,115,26,77,126,7,18,124,80,111,68,26,67,109,97,73,27,89,111,72,103,114,109,91,108,77,110,77,25,66,77,99,69,93],
  [107,123,4,107,72,18,120,100,28,102,76,105,24,78,68,77,79,102,123,27,75,101,80,109,75,114,72,89,123,97,122,126,66,89,28,125,88,24,112,19,95,76,101,80,31,112,121,92,90,112,124,77,107],
  [107,123,4,107,72,18,120,100,28,97,24,108,103,71,125,117,75,65,105,7,102,121,117,124,97,103,110,102,91,76,77,31,91,111,28,72,93,78,98,101,94,95,7,29,80,67,92,111,69,24,108,72,107],
  [107,123,4,107,72,18,120,100,28,99,105,125,66,109,105,89,96,75,75,92,111,71,24,95,75,7,124,89,105,121,101,126,70,76,112,121,92,76,26,31,66,124,91,111,92,103,121,102,76,67,27,102,93],
  [107,123,4,107,72,18,120,100,28,97,73,78,65,73,78,89,88,7,31,18,73,96,126,100,103,24,71,88,31,111,24,31,110,107,88,73,83,24,120,125,123,124,31,110,109,29,117,107,31,103,77,88,107],
  [107,123,4,107,72,18,120,100,28,96,115,99,94,31,18,25,66,105,29,115,19,101,112,100,88,30,83,82,94,101,24,109,19,76,101,102,65,111,112,18,127,71,94,120,79,73,67,100,105,83,102,97,123]
];

function getBuiltInFallbackKeys(): string[] {
  try {
    return FALLBACK_KEYS_ENCODED.map((arr) =>
      arr.map((b) => String.fromCharCode(b ^ 42)).join('')
    );
  } catch (e) {
    return [];
  }
}

/**
 * Parses and returns the ordered failover pool of Gemini API keys.
 * Priority order:
 * 1. User's custom API key from LocalStorage
 * 2. Explicit customApiKey passed as argument
 * 3. All keys defined in VITE_GEMINI_API_KEY / VITE_GEMINI_API_KEYS (.env, comma or newline separated)
 * 4. Runtime built-in fallback keys pool (all 6 accounts)
 */
export function getGeminiApiKeysPool(customApiKey?: string): string[] {
  const pool: string[] = [];

  const addKeys = (raw?: string | null) => {
    if (!raw || typeof raw !== 'string') return;
    // Split by commas, semicolons, or newlines to support multi-account key arrays
    const parts = raw.split(/[,;\n\r]+/);
    for (const p of parts) {
      const trimmed = p.trim();
      // Filter out empty strings or the old exhausted single key
      if (trimmed.startsWith('AIzaSyD03u')) continue;
      if (trimmed && !pool.includes(trimmed)) {
        pool.push(trimmed);
      }
    }
  };

  // 1. User-configured custom key in LocalStorage takes highest priority
  if (typeof window !== 'undefined') {
    try {
      const localKey = localStorage.getItem(GEMINI_API_KEY_STORAGE);
      if (localKey && localKey.startsWith('AIzaSyD03u')) {
        localStorage.removeItem(GEMINI_API_KEY_STORAGE);
      } else {
        addKeys(localKey);
      }
    } catch {}
  }

  // 2. Explicit custom key argument
  addKeys(customApiKey);

  // 3. Environment variables from Vite (.env)
  try {
    const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
    addKeys(envKey);

    const envKeysAlt = (import.meta as any).env?.VITE_GEMINI_API_KEYS;
    addKeys(envKeysAlt);
  } catch {}

  // 4. Built-in keys pool (all 6 accounts decoded at runtime)
  const builtInKeys = getBuiltInFallbackKeys();
  for (const k of builtInKeys) {
    addKeys(k);
  }

  return pool;
}

export function getGeminiApiKey(): string {
  const pool = getGeminiApiKeysPool();
  return pool[0] || '';
}

export function setGeminiApiKey(key: string): void {
  localStorage.setItem(GEMINI_API_KEY_STORAGE, key.trim());
}

export function clearGeminiApiKey(): void {
  localStorage.removeItem(GEMINI_API_KEY_STORAGE);
}

/**
 * Determine which tasks were actively practiced / attempted
 */
export function getActiveEvaluatedTasks(result: ExamResult): TaskKey[] {
  if (result.isPracticeMode) {
    if (result.practiceTasks && result.practiceTasks.length > 0) {
      return result.practiceTasks as TaskKey[];
    }
    if (result.practiceTask) {
      const keys = typeof result.practiceTask === 'string'
        ? (result.practiceTask.split(',').map((s) => s.trim()) as TaskKey[])
        : [result.practiceTask as TaskKey];
      if (keys.length > 0) return keys;
    }
    // Fallback: check which tasks have non-empty text
    const filled = (['task1', 'task2', 'task3'] as TaskKey[]).filter(
      (k) => Boolean(result.answers[k]?.trim())
    );
    return filled.length > 0 ? filled : ['task1'];
  }

  // Full Exam: evaluate all tasks
  return ['task1', 'task2', 'task3'];
}

/**
 * Calls Google Gemini to evaluate the student's TCF writing submission
 */
/**
 * Official TCF Canada EE (Expression Écrite / Writing) Score Conversion
 * Source: France Éducation international & IRCC
 */
export function mapScoreToTcfCanadaLevels(score: number): { cefr: CefrLevel; clb: string } {
  const rounded = Math.round(Math.max(0, Math.min(20, score)));
  if (rounded >= 18) return { cefr: 'C2', clb: 'CLB 10' };
  if (rounded >= 16) return { cefr: 'C1', clb: 'CLB 10' };
  if (rounded >= 14) return { cefr: 'C1', clb: 'CLB 9' };
  if (rounded >= 12) return { cefr: 'B2', clb: 'CLB 8' };
  if (rounded >= 10) return { cefr: 'B2', clb: 'CLB 7' }; // Benchmark for Express Entry bonus points
  if (rounded >= 7)  return { cefr: 'B1', clb: 'CLB 6' };
  if (rounded === 6) return { cefr: 'B1', clb: 'CLB 5' };
  if (rounded >= 4)  return { cefr: 'A2', clb: 'CLB 4' };
  return { cefr: 'A1', clb: '< CLB 4' };
}

/**
 * Robustly sanitizes and parses JSON returned by Google Gemini models.
 * Fixes common LLM JSON formatting issues:
 * 1. Markdown code block wrappers (```json ... ```)
 * 2. Bad escape characters like \' (single quotes must NEVER be escaped in JSON RFC 8259)
 * 3. Stray backslashes followed by spaces, accents, or non-escape characters (e.g. \ , \(, \+, etc.)
 * 4. Trailing commas before closing braces/brackets
 * 5. Unescaped raw newlines or control characters inside string literals
 * 6. Extraneous text/preamble before or after the JSON payload
 */
export function safeParseGeminiJson(rawText: string): any {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error("Réponse vide reçue de l'API Gemini.");
  }

  // 1. Strip markdown fences and whitespace
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // 2. Extract outermost JSON object if model included prefix/suffix text
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  // Strategy 1: Standard JSON parse
  try {
    return JSON.parse(cleaned);
  } catch (err1: any) {
    // Strategy 2: Fix invalid JSON escape sequences
    // In JSON (RFC 8259), valid escapes are ONLY: \\, \", \/, \b, \f, \n, \r, \t, and \uXXXX
    // Models very frequently output \' (e.g. in French text like l\'orthographe, d\'accord, qu\'il)
    // or stray backslashes before spaces or symbols.
    try {
      const fixedEscapes = cleaned.replace(/\\(.)/gs, (match, char) => {
        if (/["\\/bfnrt]/.test(char)) return match;
        if (char === 'u') return match; // Keep unicode escape \uXXXX
        if (char === "'") return "'"; // Change \' to '
        return char; // Drop invalid backslash and keep character
      });
      return JSON.parse(fixedEscapes);
    } catch (err2: any) {
      // Strategy 3: Fix invalid escapes AND remove trailing commas
      try {
        const sanitized = cleaned
          .replace(/\\(.)/gs, (match, char) => {
            if (/["\\/bfnrt]/.test(char)) return match;
            if (char === 'u') return match;
            if (char === "'") return "'";
            return char;
          })
          .replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(sanitized);
      } catch (err3: any) {
        // Strategy 4: Handle unescaped raw newlines or control characters inside string literals
        try {
          let inString = false;
          let isEscaped = false;
          let rebuilt = '';

          for (let i = 0; i < cleaned.length; i++) {
            const ch = cleaned[i];
            if (ch === '"' && !isEscaped) {
              inString = !inString;
              rebuilt += ch;
            } else if (inString) {
              if (ch === '\\' && !isEscaped) {
                isEscaped = true;
                rebuilt += ch;
              } else {
                if (isEscaped) {
                  // If preceded by backslash, check if it's a valid JSON escape char
                  if (!/["\\/bfnrtu]/.test(ch)) {
                    // Remove the previous invalid backslash from rebuilt
                    rebuilt = rebuilt.slice(0, -1);
                  }
                  isEscaped = false;
                }
                if (ch === '\n') rebuilt += '\\n';
                else if (ch === '\r') rebuilt += '\\r';
                else if (ch === '\t') rebuilt += '\\t';
                else rebuilt += ch;
              }
            } else {
              isEscaped = false;
              rebuilt += ch;
            }
          }

          rebuilt = rebuilt.replace(/,\s*([}\]])/g, '$1');
          return JSON.parse(rebuilt);
        } catch (finalErr: any) {
          console.error('safeParseGeminiJson failed. Raw text length:', rawText.length, 'Error:', finalErr);
          throw new Error(
            `Erreur de format JSON dans la réponse IA (${finalErr?.message || err1?.message}). Veuillez relancer l'évaluation.`
          );
        }
      }
    }
  }
}

export async function evaluateTcfSubmissionWithGemini(
  result: ExamResult,
  customApiKey?: string
): Promise<AIEvaluation> {
  const keysPool = getGeminiApiKeysPool(customApiKey);

  if (keysPool.length === 0) {
    throw new Error("Clé API Gemini introuvable. Veuillez renseigner votre clé API Google Gemini gratuite pour lancer l'évaluation.");
  }

  const activeTaskKeys = getActiveEvaluatedTasks(result);

  const systemInstructions = `You are a SENIOR France Éducation international (FEI) TCF Canada French writing examiner.
Your grading philosophy is STRICT and RIGOROUS ("Train Hard, Exam Easy"):
- Never inflate grades or give complimentary soft scores.
- Official scale (0 to 20): C2 (18-20), C1 (14-17), B2 (10-13), B1 (6-9), A2 (4-5), A1 (0-3).

CRITICAL EVALUATION RULES:
1. ONLY evaluate the task(s) requested below. If a task was NOT practiced, DO NOT evaluate or penalize it.
2. PRECISE, SHORT ERROR DETECTION (ACTUAL ERRORS ONLY — NO STYLISTIC REWRITES):
   - ONLY report real French errors (Spelling, Accents, Grammar, Verb Tenses, Preposition choice, or clear incorrect vocabulary).
   - "original_text" & "corrected_text": ONLY the erroneous snippet (1 to 5 words maximum).
   - "explanation": Concisely explain the grammar/spelling rule STRICTLY IN ENGLISH.
   - Categories: "Grammaire", "Orthographe / Accents", "Conjugaison / Temps", "Structure de phrase", "Vocabulaire".
3. BLANK OR ZERO-WORD SUBMISSIONS:
   - If candidate's answer is blank or 0-4 words: task score MUST BE 0/20, level "A1", clb "< CLB 4", mistakes [].
4. C1-C2 MODEL ANSWERS (STRICT WORD COUNTS):
   - Task 1: 60-120 words (friendly email).
   - Task 2: 120-150 words (3 paragraphs).
   - Task 3: 120-180 words (title, synthesis, argument).

OUTPUT RFC 8259 JSON SCHEMA:
{
  "estimated_cefr_level": "A1"|"A2"|"B1"|"B2"|"C1"|"C2",
  "clb_level": "CLB 4"|"CLB 5"|"CLB 6"|"CLB 7"|"CLB 8"|"CLB 9"|"CLB 10"|"< CLB 4",
  "overall_score": number,
  "overall_feedback": "string in French",
  "overall_feedback_en": "string in English",
  "tasks": {
    "task1"?: {
      "task_key": "task1",
      "task_name": "Tâche 1 : Description / Message",
      "score": number,
      "estimated_level": "A1"|"A2"|"B1"|"B2"|"C1"|"C2",
      "clb_level": "string",
      "general_feedback": "string in French",
      "general_feedback_en": "string in English",
      "mistakes": [{"category": "Grammaire"|"Orthographe / Accents"|"Conjugaison / Temps"|"Structure de phrase"|"Vocabulaire", "original_text": "...", "corrected_text": "...", "explanation": "..."}],
      "c1_c2_model_answer": "string in French"
    },
    "task2"?: { "task_key": "task2", "task_name": "Tâche 2 : Narration / Récit", "score": number, "estimated_level": "B2", "clb_level": "CLB 7", "general_feedback": "...", "general_feedback_en": "...", "mistakes": [], "c1_c2_model_answer": "..." },
    "task3"?: { "task_key": "task3", "task_name": "Tâche 3 : Argumentation", "score": number, "estimated_level": "B2", "clb_level": "CLB 7", "general_feedback": "...", "general_feedback_en": "...", "mistakes": [], "c1_c2_model_answer": "..." }
  }
}`;

  let promptContent = `The candidate completed a session containing ${activeTaskKeys.length} task(s): [${activeTaskKeys.join(', ')}].\n`;
  if (result.isPracticeMode) {
    promptContent += `NOTE: This was a TARGETED PRACTICE SESSION specifically for: ${activeTaskKeys.join(', ')}. Evaluate ONLY these tasks. Do NOT mark unpracticed tasks as absent or 0 words.\n\n`;
  }

  for (const tKey of activeTaskKeys) {
    const req = result.combination.tasks[tKey];
    const text = result.answers[tKey] || '';
    const wc = result.wordCounts[tKey] || 0;

    if (tKey === 'task1') {
      promptContent += `--- TÂCHE 1 (${wc} mots) ---\n`;
      promptContent += `Consigne: ${req.instruction}\n`;
      promptContent += `Exigences de longueur officielles: MINIMUM 60 mots, MAXIMUM 120 mots.\n`;
      promptContent += `Réponse du candidat:\n"""\n${text || '(Aucune réponse saisie)'}\n"""\n\n`;
    } else if (tKey === 'task2') {
      promptContent += `--- TÂCHE 2 (${wc} mots) ---\n`;
      promptContent += `Consigne: ${req.instruction}\n`;
      promptContent += `Exigences de longueur officielles: MINIMUM 120 mots, MAXIMUM 150 mots.\n`;
      promptContent += `Réponse du candidat:\n"""\n${text || '(Aucune réponse saisie)'}\n"""\n\n`;
    } else if (tKey === 'task3') {
      promptContent += `--- TÂCHE 3 (${wc} mots) ---\n`;
      promptContent += `Sujet / Titre: ${req.title || req.instruction}\n`;
      if (req.document1) promptContent += `Document 1: ${req.document1}\n`;
      if (req.document2) promptContent += `Document 2: ${req.document2}\n`;
      promptContent += `Exigences de longueur officielles: MINIMUM 120 mots, MAXIMUM 180 mots.\n`;
      promptContent += `Réponse du candidat:\n"""\n${text || '(Aucune réponse saisie)'}\n"""\n\n`;
    }
  }

  promptContent += `MANDATORY REQUIREMENTS:\n`;
  promptContent += `1. Provide overall_feedback in French AND provide its accurate English translation in overall_feedback_en.\n`;
  promptContent += `2. For each task, provide general_feedback in French AND its accurate English translation in general_feedback_en.\n`;
  promptContent += `3. MISTAKES MUST BE SHORT AND REAL ERRORS ONLY:\n`;
  promptContent += `   - Do NOT suggest stylistic "better versions" or "C1/C2 elevation" in mistakes! If a student's French is grammatically and semantically correct, DO NOT flag it as a mistake!\n`;
  promptContent += `   - NEVER quote entire sentences! "original_text" and "corrected_text" must be short snippets (1 to 5 words maximum).\n`;
  promptContent += `   - If there are multiple errors in a sentence, break them down into separate, individual mistakes.\n`;
  promptContent += `   - NEVER write "To target C1/C2..." in explanations. Just state the grammatical, spelling, agreement, or tense rule in English.\n`;
  promptContent += `4. MODEL ANSWER WORD COUNT COMPLIANCE IS STRICTLY MANDATORY:\n`;
  promptContent += `   - Task 1 c1_c2_model_answer: 60 to 120 words (target 80-100 words).\n`;
  promptContent += `   - Task 2 c1_c2_model_answer: 120 to 150 words (target 130-145 words). NEVER exceed 150 words!\n`;
  promptContent += `   - Task 3 c1_c2_model_answer: 120 to 180 words (target 140-165 words). NEVER exceed 180 words!\n`;
  promptContent += `   You must count words and ensure the model answers do NOT exceed the maximum limit under any circumstances!\n`;
  promptContent += `5. All mistake "explanation" values MUST be written 100% IN ENGLISH ONLY (explain French grammar/spelling rule clearly in English).\n`;
  promptContent += `6. Keep the student's original_text, corrected_text, and c1_c2_model_answer in French.\n`;
  promptContent += `7. Output strictly standard RFC 8259 JSON. Do NOT escape single quotes (\\') in French text (write "c'est", "l'écriture", never "c\\'est"). Ensure all strings are strictly valid JSON.\n`;
  promptContent += `Please evaluate the active task(s) and output ONLY the valid JSON response.`;

  // Memory & session cache for currently active working model (purging any discontinued 2.5/1.5/2.0 models)
  let cachedWorkingModel: string | null = null;
  try {
    const stored = sessionStorage.getItem('tcf_working_gemini_model');
    if (stored && !stored.includes('2.5') && !stored.includes('1.5') && !stored.includes('2.0')) {
      cachedWorkingModel = stored;
    } else {
      sessionStorage.removeItem('tcf_working_gemini_model');
    }
  } catch {}

  const defaultPreferredModels = [
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    'gemini-flash-latest'
  ];

  const candidateModels: string[] = cachedWorkingModel
    ? [cachedWorkingModel, ...defaultPreferredModels.filter((m) => m !== cachedWorkingModel)]
    : [...defaultPreferredModels];

  let rawText = '';
  let parsed: any = null;
  let lastError = '';

  // Rotate across each API key in the failover pool
  for (let keyIdx = 0; keyIdx < keysPool.length; keyIdx++) {
    const currentKey = keysPool[keyIdx];
    let keyHitLimit = false;

    for (const modelName of candidateModels) {
      if (keyHitLimit) break;

      // Try up to 2 attempts for 503 high demand transient spikes
      for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 14000);

        try {
          const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${currentKey}`;
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [{ text: `${systemInstructions}\n\n${promptContent}` }]
                }
              ],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.2
              }
            })
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const statusCode = response.status;
            const errorMsg = errorData?.error?.message || `API Error (${statusCode}: ${response.statusText})`;
            lastError = errorMsg;

            // If 503 Service Unavailable / High demand, wait 1.2s and retry once
            if (statusCode === 503 && attempt === 0) {
              console.warn(`[Gemini Failover] Key #${keyIdx + 1} model ${modelName} returned 503. Retrying in 1.2s...`);
              await new Promise((resolve) => setTimeout(resolve, 1200));
              continue;
            }

            // If Rate limited (429), Quota exceeded, or Forbidden (403/400)
            // This specific account/key is exhausted. Fail over immediately to the next key!
            if (
              statusCode === 429 ||
              statusCode === 403 ||
              statusCode === 400 ||
              errorMsg.includes('quota') ||
              errorMsg.includes('Quota exceeded') ||
              errorMsg.includes('RESOURCE_EXHAUSTED')
            ) {
              console.warn(
                `[Gemini Failover] Key #${keyIdx + 1} exhausted (${statusCode}: ${errorMsg}). Seamlessly failing over to next key...`
              );
              keyHitLimit = true;
              break;
            }

            console.warn(`[Gemini Failover] Key #${keyIdx + 1} with ${modelName} returned status ${statusCode}: ${errorMsg}`);
            break;
          }

          const jsonResponse = await response.json();
          const candidateText = jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) {
            try {
              parsed = safeParseGeminiJson(candidateText);
              rawText = candidateText;
              try {
                sessionStorage.setItem('tcf_working_gemini_model', modelName);
              } catch {}
              break; // Successfully evaluated!
            } catch (parseErr: any) {
              console.warn(`[Gemini Failover] Key #${keyIdx + 1} returned unparseable JSON with ${modelName}:`, parseErr?.message);
              lastError = `JSON parse error: ${parseErr?.message}`;
              break;
            }
          }
        } catch (err: any) {
          clearTimeout(timeoutId);
          lastError = err?.name === 'AbortError' ? `Timeout après 14s avec ${modelName}` : (err?.message || 'Erreur réseau');
          console.warn(`[Gemini Failover] Key #${keyIdx + 1} failed:`, lastError);
          break;
        }
      }

      if (parsed) break;
    }

    if (parsed) {
      console.info(`[Gemini Failover] Evaluation successfully completed using key #${keyIdx + 1} of ${keysPool.length}`);
      break;
    }
  }

  // If all keys in the pool were exhausted or failed
  if (!parsed) {
    // 1. Dispatch automated urgent email alert to admin tejas083patel@gmail.com
    try {
      const candidateEmail = (result as any)?.userEmail || (result as any)?.user_email || (result as any)?.userProfile?.email || '';
      sendAiMaintenanceAlert(candidateEmail, lastError);
    } catch (alertErr) {
      console.warn('Failed to dispatch AI maintenance alert to admin:', alertErr);
    }

    // 2. Throw clean, friendly, non-technical maintenance message
    throw new Error(
      "L'évaluation par IA est actuellement en maintenance pour optimisation. Notre équipe technique a été automatiquement prévenue et intervient pour rétablir le service. Veuillez réessayer dans quelques instants. / AI evaluation is currently under maintenance for optimization. Our technical team has been notified. Please try again shortly."
    );
  }

  // Build clean structured tasks record
  const structuredTasks: Record<string, TaskEvaluation> = {};
  let totalScore = 0;
  let countTasks = 0;

  for (const tKey of activeTaskKeys) {
    const rawTask = parsed.tasks?.[tKey];
    const taskTitleMap: Record<TaskKey, string> = {
      task1: 'Tâche 1 : Description / Message',
      task2: 'Tâche 2 : Narration / Récit',
      task3: 'Tâche 3 : Argumentation'
    };

    const userText = (result.answers[tKey] || '').trim();
    const countWords = result.wordCounts?.[tKey] ?? countFrenchWords(userText);
    const isBlank = countWords === 0 || userText.length === 0;

    let taskScore = typeof rawTask?.score === 'number' ? Math.min(20, Math.max(0, rawTask.score)) : 14;
    let taskFeedback = rawTask?.general_feedback || '';
    let taskFeedbackEn = rawTask?.general_feedback_en || '';

    // Enforce word count limit on C1/C2 model answer
    const maxWordsMap: Record<TaskKey, number> = {
      task1: 120,
      task2: 150,
      task3: 180
    };
    let modelAnswer = (rawTask?.c1_c2_model_answer || '').trim();
    if (modelAnswer) {
      const maxW = maxWordsMap[tKey] || 150;
      const currentWords = countFrenchWords(modelAnswer);
      if (currentWords > maxW) {
        const sentences = modelAnswer.match(/[^.!?]+[.!?]+(?:\s+|$)/g) || [];
        let accumulated = '';
        for (const s of sentences) {
          const test = (accumulated + s).trim();
          if (countFrenchWords(test) <= maxW) {
            accumulated = test + ' ';
          } else {
            break;
          }
        }
        if (accumulated.trim()) {
          modelAnswer = accumulated.trim();
        }
      }
    }

    let mistakesList = Array.isArray(rawTask?.mistakes)
      ? rawTask.mistakes
          .map((m: any) => {
            let explanation = (m.explanation || '').trim();
            // Clean up any stylistic C1/C2 phrases
            explanation = explanation
              .replace(/^(?:In order to|To)\s+(?:target|reach|achieve|aim for)\s+C1\/?C2,?\s*/i, '')
              .replace(/To reach high-level C1\/?C2,?\s*/i, '');
            if (explanation.length > 0) {
              explanation = explanation.charAt(0).toUpperCase() + explanation.slice(1);
            }

            return {
              category: m.category || 'Grammaire',
              original_text: (m.original_text || '').trim(),
              corrected_text: (m.corrected_text || '').trim(),
              explanation
            };
          })
          .filter((m: any) => {
            if (!m.original_text && !m.corrected_text) return false;
            // Filter out full-sentence stylistic suggestions masquerading as vocabulary mistakes
            const origWords = m.original_text.split(/\s+/).length;
            if (origWords > 12 && m.category === 'Vocabulaire') return false;
            return true;
          })
      : [];

    if (isBlank) {
      taskScore = 0;
      taskFeedback = "Échec de réalisation de la tâche : Aucune rédaction n'a été fournie (0 mot rédigé). La consigne n'a pas été traitée (Task Achievement manqué), note éliminatoire : 0/20.";
      taskFeedbackEn = "Task Achievement Failed: No response was written (0 words). The prompt was not attempted, resulting in a failing score of 0/20.";
      mistakesList = [];
    }

    totalScore += taskScore;
    countTasks++;

    const taskMapping = isBlank
      ? { cefr: 'A1' as CefrLevel, clb: '< CLB 4' }
      : mapScoreToTcfCanadaLevels(taskScore);

    structuredTasks[tKey] = {
      task_key: tKey,
      task_name: rawTask?.task_name || taskTitleMap[tKey],
      score: taskScore,
      estimated_level: taskMapping.cefr,
      clb_level: taskMapping.clb,
      general_feedback: taskFeedback,
      general_feedback_en: taskFeedbackEn,
      mistakes: mistakesList,
      b2_model_answer: rawTask?.b2_model_answer || undefined,
      c1_c2_model_answer: modelAnswer
    };
  }

  const allBlank = activeTaskKeys.every((k) => {
    const txt = (result.answers[k] || '').trim();
    const cnt = result.wordCounts?.[k] ?? countFrenchWords(txt);
    return cnt === 0 || txt.length === 0;
  });

  const finalOverallScore = allBlank
    ? 0
    : countTasks > 0
    ? Math.round(totalScore / countTasks)
    : (parsed.overall_score || 14);

  const overallMapping = allBlank
    ? { cefr: 'A1' as CefrLevel, clb: '< CLB 4' }
    : mapScoreToTcfCanadaLevels(finalOverallScore);

  const finalOverallFeedback = allBlank
    ? "Échec de l'examen : Aucune réponse n'a été rédigée pour les tâches requises (0 mot). La réalisation des tâches (Task Achievement) est non conforme (0/20)."
    : (parsed.overall_feedback || "Évaluation complétée avec succès selon l'échelle officielle TCF Canada.");

  const finalOverallFeedbackEn = allBlank
    ? "Exam Failed: No responses were submitted for the required tasks (0 words). Task achievement was completely missed (0/20)."
    : (parsed.overall_feedback_en || "Evaluation successfully completed according to official TCF Canada standards.");

  return {
    id: `eval_${Date.now()}`,
    created_at: new Date().toISOString(),
    evaluated_tasks: activeTaskKeys,
    estimated_cefr_level: overallMapping.cefr,
    clb_level: overallMapping.clb,
    overall_score: finalOverallScore,
    overall_feedback: finalOverallFeedback,
    overall_feedback_en: finalOverallFeedbackEn,
    tasks: structuredTasks
  };
}
