import { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { TaskDetail } from './components/TaskDetail';
import type { Task, TaskDetail as TaskDetailType } from '../electron/preload';

export const App = () => {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskDetail, setTaskDetail] = useState<TaskDetailType | null>(null);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const handleTaskSelect = async (taskId: string) => {
    setSelectedTaskId(taskId);
    const detail = await window.electronAPI.getTaskById(taskId);
    setTaskDetail(detail);
  };

  const handleTaskUpdate = async () => {
    if (selectedTaskId) {
      const detail = await window.electronAPI.getTaskById(selectedTaskId);
      setTaskDetail(detail);
    }
  };

  if (selectedTaskId && taskDetail) {
    return (
      <TaskDetail
        taskDetail={taskDetail}
        onBack={() => {
          setSelectedTaskId(null);
          setTaskDetail(null);
        }}
        onUpdate={handleTaskUpdate}
      />
    );
  }

  return <Dashboard onTaskSelect={handleTaskSelect} />;
};

