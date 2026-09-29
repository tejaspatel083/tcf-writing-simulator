import React from 'react';
import { TaskKey } from '../types/exam';

interface TaskSidebarProps {
  activeTask: TaskKey;
  onSelectTask: (task: TaskKey) => void;
  wordCounts: { task1: number; task2: number; task3: number };
  isPracticeMode?: boolean;
  practiceTask?: TaskKey;
}

export const TaskSidebar: React.FC<TaskSidebarProps> = ({
  activeTask,
  onSelectTask,
  wordCounts,
  isPracticeMode = false,
  practiceTask
}) => {
  const allTasks: { key: TaskKey; label: string; range: string }[] = [
    { key: 'task1', label: 'Tâche 1', range: '60-120 mots' },
    { key: 'task2', label: 'Tâche 2', range: '120-150 mots' },
    { key: 'task3', label: 'Tâche 3', range: '120-180 mots' }
  ];

  const tasks = isPracticeMode && practiceTask
    ? allTasks.filter((t) => t.key === practiceTask)
    : allTasks;


  return (
    <div className="bg-slate-50 border-r border-slate-300 w-48 shrink-0 flex flex-col p-3">
      <div className="font-bold text-slate-800 border-b border-slate-300 pb-2 mb-3 text-sm uppercase tracking-wide">
        {isPracticeMode ? 'Entraînement' : 'Tâches'}
      </div>
      <div className="space-y-2">
        {tasks.map((t) => {
          const isActive = activeTask === t.key;
          const count = wordCounts[t.key];
          return (
            <button
              key={t.key}
              onClick={() => onSelectTask(t.key)}
              className={`w-full text-left px-3 py-2.5 rounded border text-sm font-medium transition-colors flex flex-col ${
                isActive
                  ? 'bg-blue-600 border-blue-700 text-white shadow-sm'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400'
              }`}
            >
              <span className="font-semibold">{t.label}</span>
              <span className={`text-xs mt-0.5 ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>
                {count} mots
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
