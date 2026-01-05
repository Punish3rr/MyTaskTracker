import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Save, Paperclip, Image as ImageIcon, FileText, CheckCircle, Archive, Trash2 } from 'lucide-react';
import type { TaskDetail as TaskDetailType, TimelineEntry } from '../../electron/preload';
import { formatDateTime, cn } from '../lib/utils';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (e.clipboardData?.files.length) {
        const file = e.clipboardData.files[0];
        if (file.type.startsWith('image/')) {
          e.preventDefault();
          const arrayBuffer = await file.arrayBuffer();
          // Convert to Uint8Array for IPC (Buffer is Node.js only)
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

    const handleDragLeave = () => {
      setIsDragging(false);
    };

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
            // For drag-drop, Electron provides file path via dataTransfer
            const filePath = (file as any).path;
            if (filePath) {
              await handleFileAttach(filePath);
            }
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

  const handleImagePaste = async (buffer: Uint8Array) => {
    try {
      await window.electronAPI.pasteImage(task.id, buffer);
      await refreshTask();
      await window.electronAPI.checkNecromancerBonus(task.id);
    } catch (error) {
      console.error('Failed to paste image:', error);
    }
  };

  const handleFileAttach = async (filePath: string) => {
    try {
      await window.electronAPI.attachFile(task.id, filePath);
      await refreshTask();
      await window.electronAPI.checkNecromancerBonus(task.id);
    } catch (error) {
      console.error('Failed to attach file:', error);
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
          // For file input, we need to use a different approach
          // Since we can't get the file path directly, we'll need to handle this differently
          console.warn('File attachment via input requires IPC enhancement');
        }
      }
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
    await window.electronAPI.checkNecromancerBonus(task.id);
  };

  const handleStatusChange = async (status: 'OPEN' | 'DONE' | 'ARCHIVED') => {
    await window.electronAPI.updateTask({
      id: task.id,
      status,
      updateTouched: true,
    });
    await refreshTask();
  };

  const [attachmentPaths, setAttachmentPaths] = useState<Record<string, string>>({});

  const getAttachmentPath = async (relativePath: string): Promise<string> => {
    if (attachmentPaths[relativePath]) {
      return attachmentPaths[relativePath];
    }
    const absolutePath = await window.electronAPI.getAttachmentPath(relativePath);
    setAttachmentPaths(prev => ({ ...prev, [relativePath]: absolutePath }));
    return absolutePath;
  };

  const ImageEntry = ({ entry, getAttachmentPath }: { entry: TimelineEntry; getAttachmentPath: (path: string) => Promise<string> }) => {
    const [imagePath, setImagePath] = useState<string>('');

    useEffect(() => {
      getAttachmentPath(entry.content).then(setImagePath);
    }, [entry.content]);

    return (
      <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
        <div className="text-sm text-gray-400 mb-2 flex items-center gap-2">
          <ImageIcon className="w-4 h-4" />
          {formatDateTime(entry.created_at)}
        </div>
        {imagePath && (
          <img
            src={`file://${imagePath}`}
            alt="Attachment"
            className="max-w-full h-auto rounded-lg mt-2"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        <div className="text-xs text-gray-500 mt-2">{entry.content}</div>
      </div>
    );
  };

  const renderTimelineEntry = (entry: TimelineEntry) => {
    switch (entry.type) {
      case 'NOTE':
        return (
          <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
            <div className="text-sm text-gray-400 mb-2">{formatDateTime(entry.created_at)}</div>
            <div className="text-gray-200 whitespace-pre-wrap">{entry.content}</div>
          </div>
        );
      
      case 'IMAGE':
        return (
          <ImageEntry key={entry.id} entry={entry} getAttachmentPath={getAttachmentPath} />
        );
      
      case 'FILE':
        return (
          <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
            <div className="text-sm text-gray-400 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {formatDateTime(entry.created_at)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-gray-200">{entry.content.split('/').pop()}</span>
              <button
                onClick={() => {
                  // Reveal in folder - would need IPC
                  console.log('Reveal:', entry.content);
                }}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Reveal
              </button>
            </div>
          </div>
        );
      
      case 'STATUS':
        return (
          <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
            <div className="text-sm text-gray-400">{formatDateTime(entry.created_at)}</div>
            <div className="text-gray-300 mt-1">Status changed: {entry.content}</div>
          </div>
        );
      
      case 'GAMIFY':
        return (
          <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-700/30">
            <div className="text-sm text-purple-400">{formatDateTime(entry.created_at)}</div>
            <div className="text-purple-300 mt-1">🎮 {entry.content}</div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-gray-100">
      <header className="border-b border-gray-800 px-6 py-4">
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
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Metadata */}
        <div className="w-1/3 border-r border-gray-800 p-6 overflow-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-4">{task.title}</h1>
            
            <div className="space-y-3 mb-6">
              <div>
                <label className="text-sm text-gray-400">Status</label>
                <div className="mt-1">
                  <span className={cn(
                    "px-2 py-1 rounded text-xs border",
                    task.status === 'DONE' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                    task.status === 'ARCHIVED' ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' :
                    'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                  )}>
                    {task.status}
                  </span>
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
                <label className="text-sm text-gray-400">Created</label>
                <div className="mt-1 text-sm text-gray-300">{formatDateTime(task.created_at)}</div>
              </div>
              
              <div>
                <label className="text-sm text-gray-400">Last Touched</label>
                <div className="mt-1 text-sm text-gray-300">{formatDateTime(task.last_touched_at)}</div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-300">Pinned Summary</label>
              {!isEditingSummary && (
                <button
                  onClick={() => setIsEditingSummary(true)}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Edit
                </button>
              )}
            </div>
            {isEditingSummary ? (
              <div>
                <textarea
                  value={pinnedSummary}
                  onChange={(e) => setPinnedSummary(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
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
              <div className="p-3 bg-gray-800 rounded-lg border border-gray-700 min-h-[120px]">
                {task.pinned_summary ? (
                  <div className="text-sm text-gray-300 whitespace-pre-wrap">{task.pinned_summary}</div>
                ) : (
                  <div className="text-sm text-gray-500 italic">No summary pinned yet</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b border-gray-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                placeholder="Add a note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    handleAddNote();
                  }
                }}
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-2"
              >
                <Paperclip className="w-4 h-4" />
                Attach
              </button>
            </div>
            <div className="text-xs text-gray-500">Ctrl+V to paste image, or drag & drop files</div>
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
    </div>
  );
};
