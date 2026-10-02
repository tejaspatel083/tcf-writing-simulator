import React from 'react';
import { TaskKey } from '../types/exam';
import { useLanguage } from '../context/LanguageContext';

interface TaskSidebarProps {
  activeTask: TaskKey;
  onSelectTask: (task: TaskKey) => void;
  wordCounts: { task1: number; task2: number; task3: number };
  isPracticeMode?: boolean;
  practiceTask?: TaskKey | string;
  practiceTasks?: TaskKey[];
}

export const TaskSidebar: React.FC<TaskSidebarProps> = ({
  activeTask,
  onSelectTask,
  wordCounts,
  isPracticeMode = false,
  practiceTask,
  practiceTasks
}) => {
  const { t } = useLanguage();

  const allTasks: { key: TaskKey; label: string; range: string }[] = [
    { key: 'task1', label: 'Tâche 1', range: `60-120 ${t('mots')}` },
    { key: 'task2', label: 'Tâche 2', range: `120-150 ${t('mots')}` },
    { key: 'task3', label: 'Tâche 3', range: `120-180 ${t('mots')}` }
  ];

  const activeFilterList = practiceTasks && practiceTasks.length > 0
    ? practiceTasks
    : typeof practiceTask === 'string'
    ? (practiceTask.split(',') as TaskKey[])
    : practiceTask
    ? [practiceTask]
    : null;

  const tasks = isPracticeMode && activeFilterList
    ? allTasks.filter((item) => activeFilterList.includes(item.key))
    : allTasks;

  return (
    <div className="bg-slate-50 border-r border-slate-200 w-48 shrink-0 flex flex-col p-3 select-none">
      <div className="font-bold text-slate-800 border-b border-slate-200 pb-2 mb-3 text-xs uppercase tracking-wider flex items-center justify-between">
        <span>{isPracticeMode ? t('Entraînement') : t('Tâches')}</span>
        <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
      </div>
      <div className="space-y-2">
        {tasks.map((taskItem) => {
          const isActive = activeTask === taskItem.key;
          const count = wordCounts[taskItem.key];
          return (
            <button
              key={taskItem.key}
              onClick={() => onSelectTask(taskItem.key)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm font-semibold transition-all flex flex-col cursor-pointer ${
                isActive
                  ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-2xs border-l-4 border-l-blue-600'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{t(taskItem.label)}</span>
                {isActive && <span className="text-[10px] text-blue-600 font-bold">●</span>}
              </div>
              <span className={`text-xs mt-0.5 font-mono ${isActive ? 'text-blue-700 font-bold' : 'text-slate-500 font-normal'}`}>
                {count} {t('mots')}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
