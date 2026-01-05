import { useState, useEffect, useRef } from 'react';
import { Plus, Search, Ghost, Image as ImageIcon, FileText, Trash2 } from 'lucide-react';
import { useHotkeys } from 'react-hotkeys-hook';
import type { Task } from '../../electron/preload';
import { getIdleAgeColor, getIdleAgeBadge, cn } from '../lib/utils';
import { GamificationWidget } from './GamificationWidget';
import { CommandPalette } from './CommandPalette';
import { ParticleBackground } from './ParticleBackground';
import { ConfirmDialog } from './ConfirmDialog';
import { toast } from './ui/toast';

interface DashboardProps {
  onTaskSelect: (taskId: string) => void;
}

export const Dashboard = ({ onTaskSelect }: DashboardProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'LOW' | 'NORMAL' | 'HIGH'>('NORMAL');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; taskId: string | null }>({
    isOpen: false,
    taskId: null,
  });
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Hotkeys
  useHotkeys('ctrl+k', (e) => {
    e.preventDefault();
    setIsCommandPaletteOpen(true);
  });
  useHotkeys('ctrl+f', (e) => {
    e.preventDefault();
    searchInputRef.current?.focus();
  });
  useHotkeys('ctrl+n', (e) => {
    e.preventDefault();
    setIsCreating(true);
  });

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
      toast.success('Task created');
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('Failed to create task');
    }
  };

  const handleDeleteClick = (taskId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteConfirm({ isOpen: true, taskId });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.taskId || !window.electronAPI) {
      setDeleteConfirm({ isOpen: false, taskId: null });
      return;
    }

    try {
      const success = await window.electronAPI.deleteTask(deleteConfirm.taskId);
      if (success) {
        await loadTasks();
        toast.success('Task deleted');
      } else {
        toast.error('Failed to delete task');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    } finally {
      setDeleteConfirm({ isOpen: false, taskId: null });
      // Restore focus to search input
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ isOpen: false, taskId: null });
    // Restore focus to search input
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
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
    <div className="h-screen flex flex-col bg-gray-900 text-gray-100 relative overflow-hidden">
      <ParticleBackground />
      <div className="relative z-10 h-full flex flex-col">
      <header className="border-b border-gray-800 px-6 py-4 bg-gray-900/80 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold">TaskVault</h1>
          <div className="flex items-center gap-4">
            <GamificationWidget />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search tasks... (Ctrl+F)"
                value={searchQuery}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="off"
                spellCheck="false"
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
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr
                key={task.id}
                onClick={(e) => {
                  // Only navigate if click wasn't on a button or interactive element
                  if ((e.target as HTMLElement).closest('button')) {
                    return;
                  }
                  onTaskSelect(task.id);
                }}
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
                  {task.attachmentCount > 0 ? (
                    <div className="flex items-center gap-2">
                      {task.imageCount > 0 && (
                        <div className="flex items-center gap-1 text-blue-400">
                          <ImageIcon className="w-3 h-3" />
                          <span className="text-xs">{task.imageCount}</span>
                        </div>
                      )}
                      {task.fileCount > 0 && (
                        <div className="flex items-center gap-1 text-gray-400">
                          <FileText className="w-3 h-3" />
                          <span className="text-xs">{task.fileCount}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">—</span>
                  )}
                </td>
                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteClick(task.id, e)}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  {searchQuery ? 'No tasks found' : 'No tasks yet. Create your first task!'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </div>
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNewTask={() => setIsCreating(true)}
        onFocusSearch={() => searchInputRef.current?.focus()}
      />
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Task"
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
};
