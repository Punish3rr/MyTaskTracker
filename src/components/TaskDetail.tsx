// Task detail view with attachment gallery, enhanced timeline, smart functions
import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Save, Paperclip, Image as ImageIcon, FileText, CheckCircle, Archive, Trash2,
  ExternalLink, FolderOpen, Copy, Ghost, AlertTriangle, Sparkles, FileEdit,
  Phone, DollarSign, Truck, Clock
} from 'lucide-react';
import { useHotkeys } from 'react-hotkeys-hook';
import type { TaskDetail as TaskDetailType, TimelineEntry } from '../../electron/preload';
import { formatDateTime, cn, getIdleAgeColor } from '../lib/utils';
import { AttachmentGallery } from './AttachmentGallery';
import { ImageLightbox } from './ImageLightbox';
import { CommandPalette } from './CommandPalette';
import { ConfirmDialog } from './ConfirmDialog';
import { toast } from './ui/toast';

interface TaskDetailProps {
  taskDetail: TaskDetailType;
  onBack: () => void;
  onUpdate: () => void;
}

export const TaskDetail = ({ taskDetail, onBack, onUpdate }: TaskDetailProps) => {
  const [task, setTask] = useState(taskDetail.task);
  const [timeline, setTimeline] = useState(taskDetail.timeline);
  const [pinnedSummary, setPinnedSummary] = useState(task.pinned_summary);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxImagePath, setLightboxImagePath] = useState<string>('');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [attachmentPaths, setAttachmentPaths] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);
  const summaryTextareaRef = useRef<HTMLTextAreaElement>(null);
  const timelineRefs = useRef<Record<string, HTMLDivElement>>({});

  const idleAge = Math.floor((Date.now() - task.last_touched_at) / 86400000);
  const isNeglected = task.priority === 'HIGH' && idleAge > 7;

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (e.clipboardData?.files.length) {
        const file = e.clipboardData.files[0];
        if (file.type.startsWith('image/')) {
          e.preventDefault();
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          await handleImagePaste(uint8Array);
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  useEffect(() => {
    const dropZone = dropZoneRef.current;
    if (!dropZone) return;

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    };
    const handleDragLeave = () => setIsDragging(false);
    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file.type.startsWith('image/')) {
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            await handleImagePaste(uint8Array);
          } else {
            const filePath = (file as any).path;
            if (filePath) await handleFileAttach(filePath);
          }
        }
      }
    };

    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
    return () => {
      dropZone.removeEventListener('dragover', handleDragOver);
      dropZone.removeEventListener('dragleave', handleDragLeave);
      dropZone.removeEventListener('drop', handleDrop);
    };
  }, []);

  // Hotkeys
  useHotkeys('ctrl+k', (e) => {
    e.preventDefault();
    setIsCommandPaletteOpen(true);
  });
  useHotkeys('ctrl+enter', (e) => {
    e.preventDefault();
    handleAddNote();
  });

  const handleImagePaste = async (buffer: Uint8Array) => {
    try {
      await window.electronAPI.pasteImage(task.id, buffer);
      await refreshTask();
      toast.success('Image pasted');
    } catch (error) {
      console.error('Failed to paste image:', error);
      toast.error('Failed to paste image');
    }
  };

  const handleFileAttach = async (filePath: string) => {
    try {
      await window.electronAPI.attachFile(task.id, filePath);
      await refreshTask();
      toast.success('File attached');
    } catch (error) {
      console.error('Failed to attach file:', error);
      toast.error('Failed to attach file');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          await handleImagePaste(uint8Array);
        } else {
          toast.info('Please use the Attach button or drag & drop files');
        }
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const refreshTask = async () => {
    const updated = await window.electronAPI.getTaskById(task.id);
    if (updated) {
      setTask(updated.task);
      setTimeline(updated.timeline);
      setPinnedSummary(updated.task.pinned_summary);
      onUpdate();
    }
  };

  const handleSaveSummary = async () => {
    await window.electronAPI.updateTask({
      id: task.id,
      pinned_summary: pinnedSummary,
      updateTouched: true,
    });
    setIsEditingSummary(false);
    await refreshTask();
    toast.success('Summary saved');
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    await window.electronAPI.addTimelineEntry({
      taskId: task.id,
      type: 'NOTE',
      content: newNote,
      updateTouched: true,
    });
    setNewNote('');
    await refreshTask();
    toast.success('Note added');
  };

  const handleStatusChange = async (status: 'OPEN' | 'WAITING' | 'BLOCKED' | 'DONE' | 'ARCHIVED') => {
    await window.electronAPI.updateTask({
      id: task.id,
      status,
      updateTouched: true,
    });
    await refreshTask();
    toast.success(`Task marked as ${status}`);
  };

  const handlePriorityChange = async (priority: 'LOW' | 'NORMAL' | 'HIGH') => {
    await window.electronAPI.updateTask({
      id: task.id,
      priority,
    });
    await refreshTask();
    toast.success(`Priority set to ${priority}`);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const success = await window.electronAPI.deleteTask(task.id);
      if (success) {
        toast.success('Task deleted');
        onBack();
      } else {
        toast.error('Failed to delete task');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  const getAttachmentPath = async (relativePath: string): Promise<string> => {
    if (attachmentPaths[relativePath]) return attachmentPaths[relativePath];
    const absolutePath = await window.electronAPI.getAttachmentPath(relativePath);
    setAttachmentPaths(prev => ({ ...prev, [relativePath]: absolutePath }));
    return absolutePath;
  };

  const handleOpenImage = async (entry: TimelineEntry) => {
    const dataUrl = await window.electronAPI.getImageDataUrl(entry.content);
    if (dataUrl) {
      setLightboxImage(entry.content);
      setLightboxImagePath(dataUrl);
    }
  };

  const handleOpenImageExternal = async () => {
    if (lightboxImage) {
      await window.electronAPI.openAttachment(lightboxImage);
    }
  };

  const handleFileAction = async (entry: TimelineEntry, action: 'open' | 'reveal' | 'copy') => {
    try {
      if (action === 'open') {
        await window.electronAPI.openAttachment(entry.content);
        toast.success('File opened');
      } else if (action === 'reveal') {
        await window.electronAPI.revealAttachment(entry.content);
        toast.success('File location revealed');
      } else if (action === 'copy') {
        await window.electronAPI.copyAttachmentPath(entry.content);
        toast.success('Path copied to clipboard');
      }
    } catch (error) {
      console.error('File action failed:', error);
      toast.error('Action failed');
    }
  };

  const insertNotePreset = (preset: string) => {
    const presets: Record<string, string> = {
      update: 'Update: ',
      call: 'Call: ',
      quote: 'Quote: $',
      shipping: 'Shipping: ',
      waiting: 'Waiting on: ',
    };
    setNewNote(presets[preset] || '');
    noteInputRef.current?.focus();
  };

  const insertSummaryTemplate = () => {
    const template = `Goal:
Current status:
Next action:
Links/files:
Prices/quotes:`;
    setPinnedSummary(template);
    setIsEditingSummary(true);
    summaryTextareaRef.current?.focus();
  };

  const scrollToTimelineEntry = (entryId: string) => {
    const element = timelineRefs.current[entryId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-2', 'ring-blue-500');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-blue-500');
      }, 2000);
    }
  };

  const ImageEntry = ({ entry }: { entry: TimelineEntry }) => {
    const [imageDataUrl, setImageDataUrl] = useState<string>('');

    useEffect(() => {
      window.electronAPI.getImageDataUrl(entry.content).then(dataUrl => {
        if (dataUrl) setImageDataUrl(dataUrl);
      }).catch(err => {
        console.error('Failed to load image:', err);
      });
    }, [entry.content]);

    return (
      <div 
        ref={(el) => { if (el) timelineRefs.current[entry.id] = el; }}
        className="p-4 bg-gray-800/60 backdrop-blur-sm rounded-lg border border-gray-700/50"
      >
        <div className="text-sm text-gray-400 mb-2 flex items-center gap-2">
          <ImageIcon className="w-4 h-4" />
          {formatDateTime(entry.created_at)}
        </div>
        {imageDataUrl && (
          <div className="mt-2">
            <img
              src={imageDataUrl}
              alt="Attachment"
              className="max-w-md h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => handleOpenImage(entry)}
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => handleOpenImage(entry)}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                View
              </button>
              <button
                onClick={async () => {
                  await window.electronAPI.openAttachment(entry.content);
                  toast.success('Image opened');
                }}
                className="text-xs text-gray-400 hover:text-gray-300 flex items-center gap-1"
              >
                Open
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const FileEntry = ({ entry }: { entry: TimelineEntry }) => {
    const filename = entry.content.split('/').pop() || '';
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const getFileTypeLabel = () => {
      if (['pdf'].includes(ext)) return 'PDF';
      if (['doc', 'docx'].includes(ext)) return 'DOC';
      if (['xls', 'xlsx'].includes(ext)) return 'XLS';
      if (['zip', 'rar', '7z'].includes(ext)) return 'ZIP';
      return ext.toUpperCase() || 'FILE';
    };

    return (
      <div 
        ref={(el) => { if (el) timelineRefs.current[entry.id] = el; }}
        className="p-4 bg-gray-800/60 backdrop-blur-sm rounded-lg border border-gray-700/50"
      >
        <div className="text-sm text-gray-400 mb-2 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          {formatDateTime(entry.created_at)}
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-400" />
            <div>
              <div className="text-gray-200 font-medium">{filename}</div>
              <div className="text-xs text-gray-500">{getFileTypeLabel()}</div>
            </div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => handleFileAction(entry, 'open')}
              className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 rounded transition-colors"
              title="Open"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleFileAction(entry, 'reveal')}
              className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 rounded transition-colors"
              title="Reveal in folder"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleFileAction(entry, 'copy')}
              className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 rounded transition-colors"
              title="Copy path"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderTimelineEntry = (entry: TimelineEntry) => {
    switch (entry.type) {
      case 'NOTE':
        return (
          <div 
            ref={(el) => { if (el) timelineRefs.current[entry.id] = el; }}
            className="p-4 bg-gray-800/60 backdrop-blur-sm rounded-lg border border-gray-700/50"
          >
            <div className="text-sm text-gray-400 mb-2">{formatDateTime(entry.created_at)}</div>
            <div className="text-gray-200 whitespace-pre-wrap">{entry.content}</div>
          </div>
        );
      case 'IMAGE':
        return <ImageEntry key={entry.id} entry={entry} />;
      case 'FILE':
        return <FileEntry key={entry.id} entry={entry} />;
      case 'STATUS':
        return (
          <div 
            ref={(el) => { if (el) timelineRefs.current[entry.id] = el; }}
            className="p-4 bg-gray-800/60 backdrop-blur-sm rounded-lg border border-gray-700/50"
          >
            <div className="text-sm text-gray-400">{formatDateTime(entry.created_at)}</div>
            <div className="text-gray-300 mt-1">Status changed: {entry.content}</div>
          </div>
        );
      case 'GAMIFY':
        return (
          <div 
            ref={(el) => { if (el) timelineRefs.current[entry.id] = el; }}
            className="p-4 bg-purple-900/20 rounded-lg border border-purple-700/30"
          >
            <div className="text-sm text-purple-400">{formatDateTime(entry.created_at)}</div>
            <div className="text-purple-300 mt-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              {entry.content}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const attachments = timeline.filter(e => e.type === 'IMAGE' || e.type === 'FILE');
  const imageCount = timeline.filter(e => e.type === 'IMAGE').length;
  const fileCount = timeline.filter(e => e.type === 'FILE').length;

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-gray-100">
      <header className="border-b border-gray-800/50 px-6 py-4 bg-gray-900/60 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleStatusChange('DONE')}
              className="flex items-center gap-2 px-3 py-1 bg-green-600/20 text-green-400 border border-green-600/30 rounded-lg hover:bg-green-600/30 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Mark Done
            </button>
            <button
              onClick={() => handleStatusChange('ARCHIVED')}
              className="flex items-center gap-2 px-3 py-1 bg-gray-600/20 text-gray-400 border border-gray-600/30 rounded-lg hover:bg-gray-600/30 transition-colors"
            >
              <Archive className="w-4 h-4" />
              Archive
            </button>
            <button
              onClick={handleDeleteClick}
              className="flex items-center gap-2 px-3 py-1 bg-red-600/20 text-red-400 border border-red-600/30 rounded-lg hover:bg-red-600/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      </header>

      {isNeglected && (
        <div className="bg-red-900/20 border-b border-red-700/30 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">Neglected: {idleAge} days idle</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => noteInputRef.current?.focus()}
              className="px-2 py-1 text-xs bg-red-600/20 text-red-400 border border-red-600/30 rounded hover:bg-red-600/30"
            >
              Add Note
            </button>
            <button
              onClick={() => handleStatusChange('DONE')}
              className="px-2 py-1 text-xs bg-red-600/20 text-red-400 border border-red-600/30 rounded hover:bg-red-600/30"
            >
              Mark Done
            </button>
            <button
              onClick={() => handlePriorityChange('NORMAL')}
              className="px-2 py-1 text-xs bg-red-600/20 text-red-400 border border-red-600/30 rounded hover:bg-red-600/30"
            >
              Lower Priority
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <div className="w-1/3 border-r border-gray-800/50 p-6 overflow-auto glass-panel">
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-4">{task.title}</h1>
            
            <div className="space-y-3 mb-6">
              <div>
                <label className="text-sm text-gray-400">Status</label>
                <div className="mt-1">
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(e.target.value as 'OPEN' | 'WAITING' | 'BLOCKED' | 'DONE' | 'ARCHIVED')}
                    className="w-full px-3 py-1.5 bg-gray-800/60 border border-gray-700/50 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="OPEN">Open</option>
                    <option value="WAITING">Waiting</option>
                    <option value="BLOCKED">Blocked</option>
                    <option value="DONE">Done</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="text-sm text-gray-400">Priority</label>
                <div className="mt-1">
                  <span className={cn(
                    "px-2 py-1 rounded text-xs border",
                    task.priority === 'HIGH' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                    task.priority === 'NORMAL' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                    'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  )}>
                    {task.priority}
                  </span>
                </div>
              </div>
              
              <div>
                <label className="text-sm text-gray-400">Idle Age</label>
                <div className="mt-1 flex items-center gap-2">
                  {idleAge > 7 && <Ghost className={cn("w-4 h-4", getIdleAgeColor(idleAge))} />}
                  <span className={cn("text-sm font-medium font-mono", getIdleAgeColor(idleAge))}>
                    {idleAge === 0 ? 'Fresh' : idleAge === 1 ? '1 day' : `${idleAge} days`}
                  </span>
                </div>
              </div>
              
              <div>
                <label className="text-sm text-gray-400">Timeline Entries</label>
                <div className="mt-1 text-sm text-gray-300 font-mono">{timeline.length}</div>
              </div>
              
              <div>
                <label className="text-sm text-gray-400">Created</label>
                <div className="mt-1 text-sm text-gray-300 font-mono">{formatDateTime(task.created_at)}</div>
              </div>
              
              <div>
                <label className="text-sm text-gray-400">Last Touched</label>
                <div className="mt-1 text-sm text-gray-300 font-mono">{formatDateTime(task.last_touched_at)}</div>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-300">Pinned Summary</label>
              <div className="flex gap-1">
                {!isEditingSummary && !task.pinned_summary && (
                  <button
                    onClick={insertSummaryTemplate}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    title="Insert template"
                  >
                    <FileEdit className="w-3 h-3" />
                    Template
                  </button>
                )}
                {!isEditingSummary && (
                  <button
                    onClick={() => setIsEditingSummary(true)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
            {isEditingSummary ? (
              <div>
                <textarea
                  ref={summaryTextareaRef}
                  value={pinnedSummary}
                  onChange={(e) => setPinnedSummary(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800/60 backdrop-blur-sm border border-gray-700/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 mb-2"
                  rows={6}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveSummary}
                    className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
                  >
                    <Save className="w-3 h-3" />
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingSummary(false);
                      setPinnedSummary(task.pinned_summary);
                    }}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-gray-800/60 backdrop-blur-sm rounded-lg border border-gray-700/50 min-h-[120px]">
                {task.pinned_summary ? (
                  <div className="text-sm text-gray-300 whitespace-pre-wrap">{task.pinned_summary}</div>
                ) : (
                  <div className="text-sm text-gray-500 italic">No summary pinned yet</div>
                )}
              </div>
            )}
          </div>

          <AttachmentGallery
            timeline={timeline}
            onSelectAttachment={(entry) => scrollToTimelineEntry(entry.id)}
            getAttachmentPath={getAttachmentPath}
          />
        </div>

        {/* Right Panel - Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b border-gray-800/50 p-4 bg-gray-900/40 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-3">
              <input
                ref={noteInputRef}
                type="text"
                placeholder="Add a note... (Ctrl+Enter)"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    handleAddNote();
                  }
                }}
                className="flex-1 px-4 py-2 bg-gray-800/60 backdrop-blur-sm border border-gray-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <button
                onClick={handleAddNote}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Add Note
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={async () => {
                  try {
                    const filePaths = await window.electronAPI.showFilePicker();
                    for (const filePath of filePaths) {
                      await handleFileAttach(filePath);
                    }
                  } catch (error) {
                    console.error('File picker failed:', error);
                  }
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-2"
              >
                <Paperclip className="w-4 h-4" />
                Attach
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500">Presets:</span>
              <button
                onClick={() => insertNotePreset('update')}
                className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-1"
              >
                <FileEdit className="w-3 h-3" />
                Update
              </button>
              <button
                onClick={() => insertNotePreset('call')}
                className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-1"
              >
                <Phone className="w-3 h-3" />
                Call
              </button>
              <button
                onClick={() => insertNotePreset('quote')}
                className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-1"
              >
                <DollarSign className="w-3 h-3" />
                Quote
              </button>
              <button
                onClick={() => insertNotePreset('shipping')}
                className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-1"
              >
                <Truck className="w-3 h-3" />
                Shipping
              </button>
              <button
                onClick={() => insertNotePreset('waiting')}
                className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-1"
              >
                <Clock className="w-3 h-3" />
                Waiting
              </button>
            </div>
            <div className="text-xs text-gray-500 mt-2">Ctrl+V to paste image, or drag & drop files</div>
          </div>

          <div
            ref={dropZoneRef}
            className={cn(
              "flex-1 overflow-auto p-6 space-y-4",
              isDragging && "bg-blue-900/10 border-2 border-dashed border-blue-500"
            )}
          >
            {timeline.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                No timeline entries yet. Add notes, images, or files to build context.
              </div>
            ) : (
              timeline.map((entry) => (
                <div key={entry.id}>
                  {renderTimelineEntry(entry)}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {lightboxImage && (
        <ImageLightbox
          imagePath={lightboxImagePath}
          onClose={() => {
            setLightboxImage(null);
            setLightboxImagePath('');
          }}
          onOpenExternal={handleOpenImageExternal}
        />
      )}

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNewTask={() => {}}
        onToggleDone={() => handleStatusChange(task.status === 'DONE' ? 'OPEN' : 'DONE')}
        onArchive={() => handleStatusChange('ARCHIVED')}
        onSetPriority={handlePriorityChange}
        onAddNote={() => noteInputRef.current?.focus()}
        onAttachFile={async () => {
          try {
            const filePaths = await window.electronAPI.showFilePicker();
            for (const filePath of filePaths) {
              await handleFileAttach(filePath);
            }
          } catch (error) {
            console.error('File picker failed:', error);
          }
        }}
        onFocusSummary={() => {
          setIsEditingSummary(true);
          summaryTextareaRef.current?.focus();
        }}
        currentTaskId={task.id}
      />
      <ConfirmDialog
        isOpen={showDeleteConfirm}
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
