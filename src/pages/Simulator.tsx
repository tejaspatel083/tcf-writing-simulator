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
}

export const Simulator: React.FC<SimulatorProps> = ({
  combination,
  year,
  month,
  onFinishExam,
  onCancelExam
}) => {
  const [activeTask, setActiveTask] = useState<TaskKey>('task1');
  const [startedAt] = useState<string>(() => new Date().toISOString());
  const [answers, setAnswers] = useState<ExamAnswers>({
    task1: '',
    task2: '',
    task3: ''
  });
  const [isFinishModalOpen, setIsFinishModalOpen] = useState<boolean>(false);

  const draftKey = `tcf_draft_${combination.combinationNumber}_${year}_${month}`;

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
      timeUsedSeconds: 3600,
      answers,
      wordCounts: {
        task1: countFrenchWords(answers.task1),
        task2: countFrenchWords(answers.task2),
        task3: countFrenchWords(answers.task3)
      }
    });
  }, [combination, year, month, answers, onFinishExam, draftKey]);

  const { secondsRemaining, timeUsedSeconds, isFinished } = useExamTimer({
    initialMinutes: 60,
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
    // Inserts character into active task answer
    // TaskEditor handles textarea focus and cursor placement
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
      wordCounts
    });
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-white overflow-hidden select-none">
      {/* Header */}
      <Header
        onHomeClick={onCancelExam}
        subtitle="Examen en cours"
        combinationTitle={`Combinaison ${combination.combinationNumber} — ${month} ${year}`}
      />

      {/* Main Exam Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Task Navigation */}
        <TaskSidebar
          activeTask={activeTask}
          onSelectTask={setActiveTask}
          wordCounts={wordCounts}
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
        />

        {/* Right Sidebar: Timer, Accent Keyboard, Submission Conditions */}
        <SubmissionPanel
          timeRemainingSeconds={secondsRemaining}
          wordCounts={wordCounts}
          onInsertCharacter={handleInsertCharacter}
        />
      </div>

      {/* Finish Exam Confirmation Modal */}
      <ConfirmationModal
        isOpen={isFinishModalOpen}
        title="Voulez-vous vraiment terminer l'examen ?"
        message="Vous ne pourrez plus modifier vos réponses une fois la soumission validée."
        confirmLabel="Terminer"
        cancelLabel="Annuler"
        onConfirm={confirmFinish}
        onCancel={() => setIsFinishModalOpen(false)}
        isDanger={true}
      />
    </div>
  );
};
