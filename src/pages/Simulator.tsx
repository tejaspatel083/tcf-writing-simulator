import React, { useState, useEffect, useCallback } from 'react';
import { ExamCombination, ExamAnswers, TaskKey, ExamResult } from '../types/exam';
import { useExamTimer } from '../hooks/useExamTimer';
import { TaskSidebar } from '../components/TaskSidebar';
import { TaskEditor } from '../components/TaskEditor';
import { SubmissionPanel } from '../components/SubmissionPanel';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { countFrenchWords } from '../utils/wordCount';
import { Header } from '../components/Header';

interface SimulatorProps {
  combination: ExamCombination;
  year: string;
  month: string;
  onFinishExam: (result: ExamResult) => void;
  onCancelExam: () => void;
  isPracticeMode?: boolean;
  practiceTask?: TaskKey;
  durationMinutes?: number;
}

export const Simulator: React.FC<SimulatorProps> = ({
  combination,
  year,
  month,
  onFinishExam,
  onCancelExam,
  isPracticeMode = false,
  practiceTask = 'task1',
  durationMinutes = 60
}) => {
  const initialTask: TaskKey = isPracticeMode && practiceTask ? practiceTask : 'task1';
  const [activeTask, setActiveTask] = useState<TaskKey>(initialTask);
  const [answers, setAnswers] = useState<ExamAnswers>({
    task1: '',
    task2: '',
    task3: ''
  });
  const [isFinishModalOpen, setIsFinishModalOpen] = useState<boolean>(false);

  const initialDurationMinutes = isPracticeMode ? (durationMinutes || 15) : 60;
  const initialDurationSeconds = initialDurationMinutes * 60;

  const draftKey = isPracticeMode
    ? `tcf_practice_${practiceTask}_${combination.combinationNumber}_${year}_${month}`
    : `tcf_draft_${combination.combinationNumber}_${year}_${month}`;

  // Load draft from localStorage if present
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        setAnswers(JSON.parse(savedDraft));
      }
    } catch (e) {}
  }, [draftKey]);

  const wordCounts = {
    task1: countFrenchWords(answers.task1),
    task2: countFrenchWords(answers.task2),
    task3: countFrenchWords(answers.task3)
  };

  const handleTimerExpire = useCallback(() => {
    localStorage.removeItem(draftKey);
    onFinishExam({
      combination,
      year,
      month,
      timeUsedSeconds: initialDurationSeconds,
      answers,
      wordCounts: {
        task1: countFrenchWords(answers.task1),
        task2: countFrenchWords(answers.task2),
        task3: countFrenchWords(answers.task3)
      },
      isPracticeMode,
      practiceTask,
      allocatedMinutes: initialDurationMinutes
    });
  }, [combination, year, month, answers, onFinishExam, draftKey, isPracticeMode, practiceTask, initialDurationMinutes, initialDurationSeconds]);

  const { secondsRemaining, timeUsedSeconds, isFinished } = useExamTimer({
    initialMinutes: initialDurationMinutes,
    onExpire: handleTimerExpire
  });

  const handleUpdateAnswer = (val: string) => {
    setAnswers((prev) => {
      const updated = { ...prev, [activeTask]: val };
      try {
        localStorage.setItem(draftKey, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleInsertCharacter = (char: string) => {
    const activeTextarea = document.querySelector('textarea');
    if (activeTextarea) {
      const start = activeTextarea.selectionStart;
      const end = activeTextarea.selectionEnd;
      const text = activeTextarea.value;
      const newText = text.substring(0, start) + char + text.substring(end);
      handleUpdateAnswer(newText);
      
      setTimeout(() => {
        activeTextarea.focus();
        activeTextarea.setSelectionRange(start + char.length, start + char.length);
      }, 0);
    } else {
      handleUpdateAnswer(answers[activeTask] + char);
    }
  };

  const taskKeys: TaskKey[] = ['task1', 'task2', 'task3'];
  const currentIndex = taskKeys.indexOf(activeTask);

  const handlePrevTask = () => {
    if (currentIndex > 0) {
      setActiveTask(taskKeys[currentIndex - 1]);
    }
  };

  const handleNextTask = () => {
    if (currentIndex < taskKeys.length - 1) {
      setActiveTask(taskKeys[currentIndex + 1]);
    }
  };

  const confirmFinish = () => {
    localStorage.removeItem(draftKey);
    setIsFinishModalOpen(false);
    onFinishExam({
      combination,
      year,
      month,
      timeUsedSeconds,
      answers,
      wordCounts,
      isPracticeMode,
      practiceTask,
      allocatedMinutes: initialDurationMinutes
    });
  };

  const taskNumDisplay = activeTask === 'task1' ? 1 : activeTask === 'task2' ? 2 : 3;

  return (
    <div className="h-screen w-screen flex flex-col bg-white overflow-hidden select-none">
      {/* Header */}
      <Header
        onHomeClick={onCancelExam}
        subtitle={
          isPracticeMode
            ? `Entraînement individuel — Tâche ${taskNumDisplay} (${initialDurationMinutes} min)`
            : "Examen en cours"
        }
        combinationTitle={`Combinaison ${combination.combinationNumber} — ${month} ${year}`}
      />

      {/* Main Exam Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Task Navigation */}
        <TaskSidebar
          activeTask={activeTask}
          onSelectTask={setActiveTask}
          wordCounts={wordCounts}
          isPracticeMode={isPracticeMode}
          practiceTask={practiceTask}
        />

        {/* Center: Active Task Editor */}
        <TaskEditor
          taskKey={activeTask}
          taskRequirement={combination.tasks[activeTask]}
          value={answers[activeTask]}
          onChange={handleUpdateAnswer}
          onPrevTask={handlePrevTask}
          onNextTask={handleNextTask}
          onFinishExam={() => setIsFinishModalOpen(true)}
          isFirstTask={currentIndex === 0}
          isLastTask={currentIndex === taskKeys.length - 1}
          disabled={isFinished}
          isPracticeMode={isPracticeMode}
        />

        {/* Right Sidebar: Timer, Accent Keyboard, Submission Conditions */}
        <SubmissionPanel
          timeRemainingSeconds={secondsRemaining}
          wordCounts={wordCounts}
          onInsertCharacter={handleInsertCharacter}
          isPracticeMode={isPracticeMode}
          practiceTask={practiceTask}
        />
      </div>

      {/* Finish Confirmation Modal */}
      <ConfirmationModal
        isOpen={isFinishModalOpen}
        title={isPracticeMode ? "Terminer cet entraînement ?" : "Voulez-vous vraiment terminer l'examen ?"}
        message={
          isPracticeMode
            ? "Vous ne pourrez plus modifier votre réponse pour cette tâche."
            : "Vous ne pourrez plus modifier vos réponses une fois la soumission validée."
        }
        confirmLabel={isPracticeMode ? "Terminer l'entraînement" : "Terminer"}
        cancelLabel="Annuler"
        onConfirm={confirmFinish}
        onCancel={() => setIsFinishModalOpen(false)}
        isDanger={true}
      />
    </div>
  );
};
