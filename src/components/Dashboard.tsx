import { useState, useEffect } from 'react';
import { Plus, Search, Ghost } from 'lucide-react';
import type { Task } from '../../electron/preload';
import { getIdleAgeColor, getIdleAgeBadge, cn } from '../lib/utils';

interface DashboardProps {
  onTaskSelect: (taskId: string) => void;
}

export const Dashboard = ({ onTaskSelect }: DashboardProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'LOW' | 'NORMAL' | 'HIGH'>('NORMAL');

  const loadTasks = async () => {
    if (!window.electronAPI) {
      console.error('electronAPI is not available. Make sure the preload script is loaded.');
      return;
    }
    
    try {
      if (searchQuery.trim()) {
        const results = await window.electronAPI.searchTasks(searchQuery);
        setTasks(results);
      } else {
        const allTasks = await window.electronAPI.getTasks();
        setTasks(allTasks);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 5000);
    return () => clearInterval(interval);
  }, [searchQuery]);

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    
    if (!window.electronAPI) {
      console.error('electronAPI is not available. Make sure the preload script is loaded.');
      alert('Error: Electron API not available. Please restart the app.');
      return;
    }
    
    try {
      await window.electronAPI.createTask({
        title: newTaskTitle,
        priority: newTaskPriority,
      });
      
      setNewTaskTitle('');
      setNewTaskPriority('NORMAL');
      setIsCreating(false);
      await loadTasks();
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Failed to create task. Check console for details.');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'NORMAL': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'LOW': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DONE': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'ARCHIVED': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default: return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-gray-100">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">TaskVault</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {!isCreating && (
              <button
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Task
              </button>
            )}
          </div>
        </div>
        {isCreating && (
          <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
            <input
              type="text"
              placeholder="Task title..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateTask();
                if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewTaskTitle('');
                }
              }}
              autoFocus
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center gap-2">
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as 'LOW' | 'NORMAL' | 'HIGH')}
                className="px-3 py-1 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="LOW">Low Priority</option>
                <option value="NORMAL">Normal Priority</option>
                <option value="HIGH">High Priority</option>
              </select>
              <button
                onClick={handleCreateTask}
                className="px-4 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewTaskTitle('');
                }}
                className="px-4 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-gray-800 sticky top-0">
            <tr className="border-b border-gray-700">
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-300">Title</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-300">Status</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-300">Priority</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-300">Idle Age</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-300">Attachments</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr
                key={task.id}
                onClick={() => onTaskSelect(task.id)}
                className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {task.idleAge > 7 && (
                      <Ghost className={cn("w-4 h-4", getIdleAgeColor(task.idleAge))} />
                    )}
                    <span className="font-medium">{task.title}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={cn("px-2 py-1 rounded text-xs border", getStatusColor(task.status))}>
                    {task.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={cn("px-2 py-1 rounded text-xs border", getPriorityColor(task.priority))}>
                    {task.priority}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={cn("text-sm font-medium", getIdleAgeColor(task.idleAge))}>
                    {getIdleAgeBadge(task.idleAge)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-400">
                    {task.attachmentCount > 0 ? `${task.attachmentCount} file${task.attachmentCount > 1 ? 's' : ''}` : '—'}
                  </span>
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  {searchQuery ? 'No tasks found' : 'No tasks yet. Create your first task!'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
