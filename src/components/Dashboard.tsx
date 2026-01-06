// Dashboard component with event-driven updates, glassmorphism, and animations
import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Search, Ghost, Image as ImageIcon, FileText, Trash2, Clock, AlertTriangle, CheckCircle, Archive, Circle, Pencil } from 'lucide-react';
import { useHotkeys } from 'react-hotkeys-hook';
import { motion, AnimatePresence } from 'framer-motion';
import type { Task } from '../../electron/preload';
import { getIdleAgeColor, getIdleAgeBadge, cn } from '../lib/utils';
import { GamificationWidget } from './GamificationWidget';
import { CommandPalette } from './CommandPalette';
import { ParticleBackground } from './ParticleBackground';
import { ConfirmDialog } from './ConfirmDialog';
import { EditTaskDialog } from './EditTaskDialog';
import { toast } from './ui/toast';
import { useDataUpdated } from '../hooks/useDataUpdated';

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
  const [editTask, setEditTask] = useState<{ isOpen: boolean; task: Task | null }>({
    isOpen: false,
    task: null,
  });
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadTasks = useCallback(async () => {
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
  }, [searchQuery]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Listen for data-updated events from main process using hook
  useDataUpdated(loadTasks);

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
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ isOpen: false, taskId: null });
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  const handleEditClick = (task: Task, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditTask({ isOpen: true, task });
  };

  const handleEditSave = async (updates: { title?: string; priority?: string; status?: string }) => {
    if (!editTask.task || !window.electronAPI) return;
    
    try {
      await window.electronAPI.updateTask({
        id: editTask.task.id,
        ...updates,
      });
      await loadTasks();
      toast.success('Task updated');
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
      throw error;
    }
  };

  const handleEditClose = () => {
    setEditTask({ isOpen: false, task: null });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-500/20 text-red-400 border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.5)]';
      case 'NORMAL': return 'bg-blue-500/20 text-blue-400 border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.3)]';
      case 'LOW': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-blue-500/20 text-blue-400 border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.3)]';
      case 'WAITING': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 shadow-[0_0_8px_rgba(234,179,8,0.3)]';
      case 'BLOCKED': return 'bg-red-500/20 text-red-400 border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.3)]';
      case 'DONE': return 'bg-green-500/20 text-green-400 border-green-500/30 shadow-[0_0_8px_rgba(34,197,94,0.3)]';
      case 'ARCHIVED': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OPEN': return <Circle className="w-3 h-3" />;
      case 'WAITING': return <Clock className="w-3 h-3" />;
      case 'BLOCKED': return <AlertTriangle className="w-3 h-3" />;
      case 'DONE': return <CheckCircle className="w-3 h-3" />;
      case 'ARCHIVED': return <Archive className="w-3 h-3" />;
      default: return null;
    }
  };

  const formatRelativeTime = (timestamp: number | null): string => {
    if (!timestamp) return '—';
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const sanitizeSnippet = (content: string | null, maxLength: number = 100): string => {
    if (!content) return '';
    return content.replace(/\n/g, ' ').trim().substring(0, maxLength) + (content.length > maxLength ? '...' : '');
  };

  const handleRowKeyDown = (e: React.KeyboardEvent, taskId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTaskSelect(taskId);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-gray-100 relative overflow-hidden">
      <ParticleBackground />
      <div className="relative z-10 h-full flex flex-col">
      <header className="border-b border-gray-800/50 px-6 py-4 bg-gray-900/60 backdrop-blur-xl backdrop-saturate-150 flex-shrink-0">
        <div className="flex flex-row items-center justify-between w-full min-w-0 flex-nowrap">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent flex-shrink-0 mr-4">
            TaskVault
          </h1>
          <div className="flex flex-row items-center gap-4 flex-shrink-0 min-w-0 flex-nowrap">
            <div className="flex-shrink-0">
              <GamificationWidget />
            </div>
            <div className="relative flex-shrink-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search tasks... (Ctrl+F)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-800/60 backdrop-blur-sm border border-gray-700/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all w-64"
                autoComplete="off"
                spellCheck="false"
              />
            </div>
            {!isCreating && (
              <motion.button
                onClick={() => setIsCreating(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600/80 hover:bg-blue-700/80 rounded-lg transition-all shadow-[0_0_12px_rgba(59,130,246,0.4)] hover:shadow-[0_0_16px_rgba(59,130,246,0.6)] whitespace-nowrap flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                New Task
              </motion.button>
            )}
          </div>
        </div>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4 p-4 bg-gray-800/60 backdrop-blur-sm rounded-lg border border-gray-700/50 shadow-lg"
          >
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
              className="w-full px-4 py-2 bg-gray-700/60 backdrop-blur-sm border border-gray-600/50 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
            />
            <div className="flex items-center gap-2">
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as 'LOW' | 'NORMAL' | 'HIGH')}
                className="px-3 py-1 bg-gray-700/60 backdrop-blur-sm border border-gray-600/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              >
                <option value="LOW">Low Priority</option>
                <option value="NORMAL">Normal Priority</option>
                <option value="HIGH">High Priority</option>
              </select>
              <motion.button
                onClick={handleCreateTask}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-1 bg-blue-600/80 hover:bg-blue-700/80 rounded-lg text-sm transition-all shadow-[0_0_8px_rgba(59,130,246,0.3)]"
              >
                Create
              </motion.button>
              <motion.button
                onClick={() => {
                  setIsCreating(false);
                  setNewTaskTitle('');
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-1 bg-gray-700/60 hover:bg-gray-600/60 rounded-lg text-sm transition-all"
              >
                Cancel
              </motion.button>
            </div>
          </motion.div>
        )}
      </header>

      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-gray-800/60 backdrop-blur-xl sticky top-0 z-20">
            <tr className="border-b border-gray-700/50">
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-300">Title</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-300">Status</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-300">Priority</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-300">Age</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-300">Idle</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-300">Attachments</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-300">Actions</th>
            </tr>
          </thead>
          <motion.tbody
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.05,
                },
              },
            }}
            initial="hidden"
            animate="visible"
          >
            <AnimatePresence mode="popLayout">
              {tasks.slice(0, 50).map((task, index) => (
                <motion.tr
                  key={task.id}
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button')) {
                      return;
                    }
                    onTaskSelect(task.id);
                  }}
                  onKeyDown={(e) => handleRowKeyDown(e, task.id)}
                  tabIndex={0}
                  className="border-b border-gray-800/50 hover:bg-gray-800/40 cursor-pointer transition-all group relative glass-panel"
                  whileHover={{ scale: 1.01, backgroundColor: 'rgba(31, 41, 55, 0.4)' }}
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
                    <span className={cn("px-2 py-1 rounded text-xs border flex items-center gap-1.5 w-fit", getStatusColor(task.status))}>
                      {getStatusIcon(task.status)}
                      {task.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn("px-2 py-1 rounded text-xs border", getPriorityColor(task.priority))}>
                      {task.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium font-mono text-gray-400">
                      {task.daysOld === 0 ? 'Today' : task.daysOld === 1 ? '1 day' : `${task.daysOld} days`}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn("text-sm font-medium font-mono", getIdleAgeColor(task.idleAge))}>
                      {getIdleAgeBadge(task.idleAge)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {task.latestEntryType ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-sm">
                          {task.latestEntryType === 'NOTE' && (
                            <>
                              <FileText className="w-3 h-3 text-gray-400" />
                              <span className="text-gray-300 text-xs truncate max-w-[200px]">
                                {sanitizeSnippet(task.latestEntryContent)}
                              </span>
                            </>
                          )}
                          {task.latestEntryType === 'IMAGE' && (
                            <>
                              <ImageIcon className="w-3 h-3 text-blue-400" />
                              <span className="text-gray-400 text-xs">Image</span>
                            </>
                          )}
                          {task.latestEntryType === 'FILE' && (
                            <>
                              <FileText className="w-3 h-3 text-gray-400" />
                              <span className="text-gray-400 text-xs truncate max-w-[150px]">
                                {task.latestEntryContent ? task.latestEntryContent.split('/').pop() : 'File'}
                              </span>
                            </>
                          )}
                          {(task.latestEntryType === 'STATUS' || task.latestEntryType === 'GAMIFY') && (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </div>
                        {task.latestEntryDate && (
                          <span className="text-xs text-gray-500 font-mono">
                            {formatRelativeTime(task.latestEntryDate)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {task.attachmentCount > 0 ? (
                      <div className="flex items-center gap-2">
                        {task.imageCount > 0 && (
                          <div className="flex items-center gap-1 text-blue-400">
                            <ImageIcon className="w-3 h-3" />
                            <span className="text-xs font-mono">{task.imageCount}</span>
                          </div>
                        )}
                        {task.fileCount > 0 && (
                          <div className="flex items-center gap-1 text-gray-400">
                            <FileText className="w-3 h-3" />
                            <span className="text-xs font-mono">{task.fileCount}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <motion.button
                        type="button"
                        onClick={(e) => handleEditClick(task, e)}
                        onMouseDown={(e) => e.stopPropagation()}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-all"
                        title="Edit task"
                      >
                        <Pencil className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={(e) => handleDeleteClick(task.id, e)}
                        onMouseDown={(e) => e.stopPropagation()}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                        title="Delete task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              {tasks.length > 50 && (
                <motion.tr
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-b border-gray-800/50"
                >
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500 text-sm">
                    Showing first 50 tasks. Use search to find more.
                  </td>
                </motion.tr>
              )}
            </AnimatePresence>
            {tasks.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  {searchQuery ? 'No tasks found' : 'No tasks yet. Create your first task!'}
                </td>
              </tr>
            )}
          </motion.tbody>
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
      <EditTaskDialog
        isOpen={editTask.isOpen}
        task={editTask.task}
        onClose={handleEditClose}
        onSave={handleEditSave}
      />
    </div>
  );
};
