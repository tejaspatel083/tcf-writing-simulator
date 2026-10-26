export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface MistakeItem {
  category: 'Grammaire' | 'Orthographe / Accents' | 'Conjugaison / Temps' | 'Structure de phrase' | 'Vocabulaire' | string;
  original_text: string;
  corrected_text: string;
  explanation: string;
}

export interface TaskEvaluation {
  task_key: 'task1' | 'task2' | 'task3';
  task_name: string;
  score: number; // e.g. out of 20
  estimated_level: CefrLevel;
  clb_level?: string; // e.g. 'CLB 7', 'CLB 8', 'CLB 9', 'CLB 10'
  general_feedback: string;
  general_feedback_en?: string;
  mistakes: MistakeItem[];
  c1_c2_model_answer: string;
  b2_model_answer?: string;
}

export interface AIEvaluation {
  id: string;
  created_at: string;
  evaluated_tasks: ('task1' | 'task2' | 'task3')[];
  estimated_cefr_level: CefrLevel;
  clb_level?: string; // e.g. 'CLB 7', 'CLB 8', 'CLB 9', 'CLB 10'
  overall_score: number; // e.g. average or single task score out of 20
  overall_feedback: string;
  overall_feedback_en?: string;
  tasks: {
    task1?: TaskEvaluation;
    task2?: TaskEvaluation;
    task3?: TaskEvaluation;
  };
}

export interface SavedMistake {
  id: string;
  category: string;
  original_text: string;
  corrected_text: string;
  explanation: string;
  task_key?: 'task1' | 'task2' | 'task3';
  task_name?: string;
  submission_id?: string;
  exam_title?: string;
  date: string;
  timestamp: number;
}
