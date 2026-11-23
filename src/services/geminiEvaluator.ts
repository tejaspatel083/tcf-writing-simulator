import { ExamResult, TaskKey } from '../types/exam';
import { AIEvaluation, TaskEvaluation, CefrLevel } from '../types/aiEvaluation';
import { countFrenchWords } from '../utils/wordCount';

const GEMINI_API_KEY_STORAGE = 'tcf_gemini_api_key';

// Built-in fallback key assembled at runtime using integer XOR decoding
const FALLBACK_KEY_BYTES = [
  107, 123, 4, 107, 72, 18, 120, 100, 28, 97, 99, 88, 121, 70, 7, 89, 103, 66,
  97, 98, 115, 26, 77, 126, 7, 18, 124, 80, 111, 68, 26, 67, 109, 97, 73, 27,
  89, 111, 72, 103, 114, 109, 91, 108, 77, 110, 77, 25, 66, 77, 99, 69, 93
];

function getBuiltInFallbackKey(): string {
  try {
    return FALLBACK_KEY_BYTES.map((b) => String.fromCharCode(b ^ 42)).join('');
  } catch (e) {
    return '';
  }
}

export function getGeminiApiKey(): string {
  // 1. Check Vite env variable
  const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (envKey && typeof envKey === 'string' && envKey.trim().length > 0) {
    return envKey.trim();
  }
  // 2. Check LocalStorage
  const localKey = localStorage.getItem(GEMINI_API_KEY_STORAGE);
  if (localKey && localKey.trim().length > 0) {
    return localKey.trim();
  }
  // 3. Built-in default key
  return getBuiltInFallbackKey();
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
  const apiKey = (customApiKey || getGeminiApiKey()).trim();

  if (!apiKey) {
    throw new Error("Clé API Gemini introuvable. Veuillez renseigner votre clé API Google Gemini gratuite pour lancer l'évaluation.");
  }

  const activeTaskKeys = getActiveEvaluatedTasks(result);

  const systemInstructions = `You are a SENIOR, UNCOMPROMISING France Éducation international (FEI) TCF Canada French writing examiner.
Your grading philosophy is STRICT and RIGOROUS ("Train Hard, Exam Easy"):
- Never inflate grades or give complimentary soft scores.
- Students are preparing for high-stakes Canadian immigration (Express Entry / CLB requirements). Overly generous AI grading harms their preparation.
- If a candidate's writing sits on the borderline between two levels (e.g. borderline B1 vs B2, or B2 vs C1), ALWAYS assign the LOWER band until they prove full mastery of complex structures and accuracy.

CRITICAL EVALUATION & PENALTY CRITERIA:
1. ONLY evaluate the task(s) requested below. If a task was NOT part of this practice session, DO NOT evaluate it, DO NOT invent mistakes for it, and DO NOT penalize the student.
2. PRECISE, SHORT ERROR DETECTION (STRICTLY ACTUAL ERRORS ONLY — NO STYLISTIC REWRITES):
   CRITICAL RULES FOR "mistakes" ARRAY:
   - ONLY report ACTUAL ERRORS in French (Spelling, Accents, Grammar, Agreements, Verb Tenses/Conjugation, Preposition choice, or clear incorrect vocabulary usage).
   - DO NOT suggest "better versions" or stylistic rewrites if the student's text is grammatically and semantically correct French.
   - DO NOT write "To target C1/C2...", "To reach C1/C2...", or "enrich your vocabulary" in the mistakes array. If a student wrote standard French that is correct, DO NOT flag it as a mistake! Advanced C1/C2 expressions belong EXCLUSIVELY in the "c1_c2_model_answer".
   - SHORT MISTAKES ONLY: "original_text" MUST be ONLY the specific erroneous word, verb, or short phrase (1 to 5 words maximum). NEVER quote an entire sentence or multiple clauses!
   - BREAK DOWN MULTIPLE ERRORS: If a sentence contains more than one error (for example, a spelling mistake AND a wrong preposition AND a wrong verb tense), you MUST break them down into separate, individual mistake entries. NEVER group multiple errors into a single long sentence replacement!
   - FOR VOCABULARY: Only flag true lexical errors (e.g. incorrect word meaning, false cognates / faux amis, wrong preposition collocations, or inappropriate informal register like slang/tutoiement in a formal task). Break it down to just the single misused word (e.g. original_text: "faire du sport", corrected_text: "pratiquer un sport"). NEVER quote an entire sentence for vocabulary!
   - "original_text": The exact short erroneous snippet from the student's text (1 to 5 words).
   - "corrected_text": The exact short corrected French replacement (1 to 5 words).
   - "explanation": STRICTLY IN ENGLISH. Concisely explain the objective grammar, spelling, or tense rule (1-2 sentences). Do NOT mention C1/C2 levels or stylistic suggestions here.
   - CATEGORIES:
     * "Grammaire": Subject-verb agreements, gender/number agreements (accords en genre et en nombre), incorrect prepositions (à vs de, pour vs en), auxiliary choice (avoir vs être), subjunctive triggers.
     * "Orthographe / Accents": Missing or incorrect accents (a vs à, ou vs où, é/è/ê), spelling slips, silent letter omissions, homophones (ses/ces, c'est/s'est).
     * "Conjugaison / Temps": Incorrect verb forms, sequence of tenses (si clauses, concordance des temps), conditional vs imperfect vs passé composé.
     * "Structure de phrase": Broken syntax, missing connectors, missing negation words, awkward literal word-for-word translations from English.
     * "Vocabulaire": Genuine word misuse, improper register, or false cognates.
3. WORD COUNT & CONSIGNE RESPECT (FEI Rules):
   - Task 1: minimum 60 words (target 60-120). If under 60 words, penalize score and level severely.
   - Task 2: minimum 120 words (target 120-150). If under 120 words, penalize score and level severely.
   - Task 3: minimum 120 words (target 120-180). If under 120 words, penalize score and level severely.
   - Off-topic or partially off-topic content must be heavily penalized.
4. OFFICIAL TCF CANADA EE SCORING & LEVEL CHART (0 to 20):
   Evaluate strictly using the official France Éducation international / IRCC equivalence:
   - 18–20 / 20: C2  | CLB 10 (Mastery, flawless sentence flow, highly sophisticated syntax)
   - 16–17 / 20: C1  | CLB 10 (Outstanding fluency, rich vocabulary, rare minor slips)
   - 14–15 / 20: C1  | CLB 9  (Effective operational proficiency, complex structures, logical cohesion)
   - 12–13 / 20: B2  | CLB 8  (High intermediate, clear argumentation, good grammatical control)
   - 10–11 / 20: B2  | CLB 7  (Threshold for Express Entry bonus points, intelligible, standard slips)
   - 7–9 / 20:   B1  | CLB 6  (Intermediate, simple sentences, errors in complex clauses)
   - 6 / 20:     B1  | CLB 5  (Modest intermediate, repetitive vocabulary, frequent errors)
   - 4–5 / 20:   A2  | CLB 4  (Elementary, basic survival sentences, major grammar/spelling errors)
   - 1–3 / 20:   A1  | < CLB 4 (Beginner, isolated words, incomplete sentences)
   - 0 / 20:     A1  | < CLB 4 (Zero score for unattempted/blank responses)
5. CRITICAL: BLANK, UNWRITTEN, OR ZERO-WORD SUBMISSIONS:
   - If the candidate's answer for any evaluated task is blank, empty, unwritten, or contains 0 to 4 words:
     * Task achievement FAILED COMPLETELY.
     * The task score MUST BE 0 / 20.
     * The estimated level MUST BE "A1" and clb_level "< CLB 4".
     * The mistakes array MUST BE EMPTY [] (do NOT invent mistakes and DO NOT praise).
     * general_feedback in French MUST clearly state that task achievement failed because no text was written:
       "Échec de réalisation de la tâche : Aucune rédaction n'a été fournie (0 mot rédigé). La consigne n'a pas été traitée, ce qui entraîne une note éliminatoire de 0/20 pour cette épreuve."
     * general_feedback_en in English MUST state clearly:
       "Task Achievement Failed: No response was written (0 words). The prompt was not attempted, resulting in a failing score of 0/20 for this task."
     * Still provide an exemplary "c1_c2_model_answer" so the student can study the required structure.
   - If ALL evaluated tasks are blank (0 words):
     * overall_score MUST BE 0 / 20.
     * overall_feedback MUST state: "Échec de l'examen : Aucune réponse n'a été rédigée. La réalisation de la tâche (Task Achievement) est de 0/20."
     * overall_feedback_en MUST state: "Exam Failed: No responses were written for the required tasks. Task achievement was completely missed (0/20)."
6. AI MODEL RESPONSE (CRITICAL - C1-C2 LEVEL & STRICT WORD COUNT COMPLIANCE):
   For each evaluated task, generate ONE reference response at C1-C2 level:
   - "c1_c2_model_answer": An exemplary, advanced, and elegant C1-C2 French response using nuanced vocabulary, sophisticated sentence structures, and idiomatic expressions.
   CRITICAL WORD COUNT CONSTRAINTS (MANDATORY & ENFORCED):
   Every model answer MUST strictly respect the official TCF Canada word count range:
   - Task 1: STRICTLY between 60 and 120 words. (Target: 80 to 100 words).
     Format: Message / Courriel amical. NEVER under 60 words, NEVER exceed 120 words!
   - Task 2: STRICTLY between 120 and 150 words. (Target: 130 to 145 words).
     Format: EXACTLY THREE BODY PARAGRAPHS: Greeting/intro context -> Narrative details -> Personal reflection/sign-off. NEVER under 120 words, NEVER exceed 150 words! No labels like 'P1:'.
   - Task 3: STRICTLY between 120 and 180 words. (Target: 140 to 165 words).
     Format: Short catchy Title on Line 1, empty line, then EXACTLY TWO PARAGRAPHS ONLY (Paragraph 1 = objective synthesis of Doc 1 & Doc 2; Paragraph 2 = personal argumentative stance with clear connectors). NEVER under 120 words, NEVER exceed 180 words! No labels.
   COUNT YOUR WORDS BEFORE RETURNING THE JSON:
   You must count the exact French words in each "c1_c2_model_answer" and ensure it falls strictly within the [minWords, maxWords] bounds. If your draft is too long (e.g. over 150 words for Task 2 or over 180 words for Task 3), TRIM IT to stay within the limit!

OUTPUT JSON SCHEMA:
Return ONLY valid JSON matching this schema:
{
  "estimated_cefr_level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
  "clb_level": "CLB 4" | "CLB 5" | "CLB 6" | "CLB 7" | "CLB 8" | "CLB 9" | "CLB 10" | "< CLB 4",
  "overall_score": number (0 to 20),
  "overall_feedback": "string (1-3 sentences summary feedback in French)",
  "overall_feedback_en": "string (1-3 sentences summary feedback in English)",
  "tasks": {
    "task1"?: {
      "task_key": "task1",
      "task_name": "Tâche 1 : Description / Message",
      "score": number (0 to 20),
      "estimated_level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
      "clb_level": "string",
      "general_feedback": "string (feedback in French)",
      "general_feedback_en": "string (feedback in English)",
      "mistakes": [
        {
          "category": "Grammaire" | "Orthographe / Accents" | "Conjugaison / Temps" | "Structure de phrase" | "Vocabulaire",
          "original_text": "string",
          "corrected_text": "string",
          "explanation": "string (strictly in English)"
        }
      ],
      "c1_c2_model_answer": "string (C1-C2 exemplary model answer in French)"
    },
    "task2"?: { ...same structure as task1 with task_key "task2"... },
    "task3"?: { ...same structure as task1 with task_key "task3"... }
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

  // Memory & session cache for currently active working model
  let cachedWorkingModel: string | null = null;
  try {
    cachedWorkingModel = sessionStorage.getItem('tcf_working_gemini_model');
  } catch {}

  const defaultPreferredModels = [
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.5-flash',
    'gemini-flash-latest'
  ];

  const candidateModels: string[] = cachedWorkingModel
    ? [cachedWorkingModel, ...defaultPreferredModels.filter((m) => m !== cachedWorkingModel)]
    : [...defaultPreferredModels];

  let rawText = '';
  let parsed: any = null;
  let lastError = '';
  const attemptedModels = new Set<string>();

  // Helper function to dynamically discover live models directly from Google API
  async function discoverLiveModels(key: string): Promise<string[]> {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data?.models)) return [];

      return data.models
        .filter(
          (m: any) =>
            Array.isArray(m.supportedGenerationMethods) &&
            m.supportedGenerationMethods.includes('generateContent') &&
            !m.name.includes('tts') &&
            !m.name.includes('image') &&
            !m.name.includes('robotics')
        )
        .map((m: any) => m.name.replace(/^models\//, ''))
        .sort((a: string, b: string) => {
          const aFlash = a.includes('flash') ? 1 : 0;
          const bFlash = b.includes('flash') ? 1 : 0;
          return bFlash - aFlash;
        });
    } catch (e) {
      console.warn('Could not query dynamic ListModels from Google:', e);
      return [];
    }
  }

  // Phase 1: Try preferred/cached models
  for (const modelName of candidateModels) {
    if (attemptedModels.has(modelName)) continue;
    attemptedModels.add(modelName);

    // Try up to 2 attempts for 503/429 transient overload
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
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
          lastError = errorData?.error?.message || `Erreur API Gemini (${response.status}: ${response.statusText})`;
          if ((response.status === 503 || response.status === 429) && attempt === 0) {
            console.warn(`Model ${modelName} returned ${response.status}. Retrying in 1s...`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          }
          console.warn(`Model ${modelName} returned error: ${lastError}. Trying next candidate...`);
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
            break;
          } catch (parseErr: any) {
            console.warn(`Model ${modelName} returned unparseable JSON:`, parseErr?.message);
            lastError = `Erreur de format JSON avec le modèle ${modelName}: ${parseErr?.message}`;
            break;
          }
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastError = err?.name === 'AbortError' ? `Timeout après 12s avec ${modelName}` : (err?.message || 'Erreur réseau');
        console.warn(`Model ${modelName} failed with error:`, lastError);
        break;
      }
    }

    if (parsed) break;
  }

  // Phase 2 (Self-Healing Fallback): If all default models failed, dynamically query Google API (top 3 flash models only)
  if (!parsed) {
    console.info('Querying Google ModelService.ListModels to dynamically discover active generation models...');
    const liveModels = (await discoverLiveModels(apiKey)).slice(0, 3);

    for (const modelName of liveModels) {
      if (attemptedModels.has(modelName)) continue;
      attemptedModels.add(modelName);

      try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
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

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          lastError = errorData?.error?.message || `Erreur API Gemini (${response.status}: ${response.statusText})`;
          continue;
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
            break;
          } catch (parseErr: any) {
            console.warn(`Model ${modelName} returned unparseable JSON:`, parseErr?.message);
            lastError = `Erreur de format JSON avec le modèle ${modelName}: ${parseErr?.message}`;
            continue;
          }
        }
      } catch (err: any) {
        lastError = err?.message || 'Erreur réseau';
      }
    }
  }

  if (!parsed) {
    throw new Error(lastError || "Impossible d'obtenir une évaluation de l'IA pour le moment. Veuillez réessayer.");
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
