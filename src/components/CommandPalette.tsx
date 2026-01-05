// Command palette component (Ctrl+K)
import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { 
  Plus, CheckCircle, Archive, ArrowUp, ArrowDown, 
  FileText, Paperclip, Edit, Search
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNewTask: () => void;
  onToggleDone?: () => void;
  onArchive?: () => void;
  onSetPriority?: (priority: 'HIGH' | 'NORMAL' | 'LOW') => void;
  onAddNote?: () => void;
  onAttachFile?: () => void;
  onFocusSummary?: () => void;
  onFocusSearch?: () => void;
  currentTaskId?: string | null;
}

export const CommandPalette = ({
  isOpen,
  onClose,
  onNewTask,
  onToggleDone,
  onArchive,
  onSetPriority,
  onAddNote,
  onAttachFile,
  onFocusSummary,
  onFocusSearch,
  currentTaskId,
}: CommandPaletteProps) => {
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelect = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[20vh]"
      onClick={onClose}
    >
      <Command
        className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
          <Search className="w-4 h-4 text-gray-400" />
          <Command.Input
            placeholder="Type a command or search..."
            value={search}
            onValueChange={setSearch}
            className="flex-1 bg-transparent text-gray-100 placeholder-gray-500 outline-none"
            autoFocus
          />
        </div>
        <Command.List className="max-h-96 overflow-y-auto p-2">
          <Command.Empty className="py-8 text-center text-gray-500 text-sm">
            No results found.
          </Command.Empty>

          <Command.Group heading="General">
            <Command.Item
              onSelect={() => handleSelect(onNewTask)}
              className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer hover:bg-gray-800"
            >
              <Plus className="w-4 h-4" />
              <span>New Task</span>
              <kbd className="ml-auto text-xs bg-gray-800 px-2 py-1 rounded">Ctrl+N</kbd>
            </Command.Item>
            <Command.Item
              onSelect={() => handleSelect(() => onFocusSearch?.())}
              className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer hover:bg-gray-800"
            >
              <Search className="w-4 h-4" />
              <span>Focus Search</span>
              <kbd className="ml-auto text-xs bg-gray-800 px-2 py-1 rounded">Ctrl+F</kbd>
            </Command.Item>
          </Command.Group>

          {currentTaskId && (
            <>
              <Command.Group heading="Task Actions">
                {onToggleDone && (
                  <Command.Item
                    onSelect={() => handleSelect(onToggleDone)}
                    className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer hover:bg-gray-800"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Toggle Done</span>
                  </Command.Item>
                )}
                {onArchive && (
                  <Command.Item
                    onSelect={() => handleSelect(onArchive)}
                    className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer hover:bg-gray-800"
                  >
                    <Archive className="w-4 h-4" />
                    <span>Archive</span>
                  </Command.Item>
                )}
                {onSetPriority && (
                  <>
                    <Command.Item
                      onSelect={() => handleSelect(() => onSetPriority('HIGH'))}
                      className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer hover:bg-gray-800"
                    >
                      <ArrowUp className="w-4 h-4 text-red-400" />
                      <span>Set Priority: High</span>
                    </Command.Item>
                    <Command.Item
                      onSelect={() => handleSelect(() => onSetPriority('NORMAL'))}
                      className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer hover:bg-gray-800"
                    >
                      <ArrowDown className="w-4 h-4 text-blue-400" />
                      <span>Set Priority: Normal</span>
                    </Command.Item>
                    <Command.Item
                      onSelect={() => handleSelect(() => onSetPriority('LOW'))}
                      className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer hover:bg-gray-800"
                    >
                      <ArrowDown className="w-4 h-4 text-gray-400" />
                      <span>Set Priority: Low</span>
                    </Command.Item>
                  </>
                )}
              </Command.Group>

              <Command.Group heading="Content">
                {onAddNote && (
                  <Command.Item
                    onSelect={() => handleSelect(onAddNote)}
                    className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer hover:bg-gray-800"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Add Note</span>
                    <kbd className="ml-auto text-xs bg-gray-800 px-2 py-1 rounded">Ctrl+Enter</kbd>
                  </Command.Item>
                )}
                {onAttachFile && (
                  <Command.Item
                    onSelect={() => handleSelect(onAttachFile)}
                    className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer hover:bg-gray-800"
                  >
                    <Paperclip className="w-4 h-4" />
                    <span>Attach File</span>
                  </Command.Item>
                )}
                {onFocusSummary && (
                  <Command.Item
                    onSelect={() => handleSelect(onFocusSummary)}
                    className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer hover:bg-gray-800"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit Pinned Summary</span>
                  </Command.Item>
                )}
              </Command.Group>
            </>
          )}
        </Command.List>
      </Command>
    </div>
  );
};
