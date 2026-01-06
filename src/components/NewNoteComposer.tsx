// Isolated note composer component to prevent TaskDetail rerenders on keystroke
import { useState, useRef } from 'react';
import { Paperclip, FileEdit, Phone, DollarSign, Truck, Clock } from 'lucide-react';

interface NewNoteComposerProps {
  onAddNote: (content: string) => Promise<void>;
  onInsertPreset: (preset: string) => void;
  onFileAttach: (filePath: string) => Promise<void>;
  onFilePicker: () => Promise<void>;
}

export const NewNoteComposer = ({ onAddNote, onInsertPreset, onFileAttach, onFilePicker }: NewNoteComposerProps) => {
  const [newNote, setNewNote] = useState('');
  const noteInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    await onAddNote(newNote);
    setNewNote('');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = (file as any).path;
        if (filePath) {
          await onFileAttach(filePath);
        }
      }
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const insertPreset = (preset: string) => {
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

  return (
    <div className="border-b border-gray-800/50 p-4 bg-gray-900/40 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-3">
        <input
          ref={noteInputRef}
          type="text"
          placeholder="Add a note... (Press Enter)"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
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
          onClick={onFilePicker}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-2"
        >
          <Paperclip className="w-4 h-4" />
          Attach
        </button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500">Presets:</span>
        <button
          onClick={() => insertPreset('update')}
          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-1"
        >
          <FileEdit className="w-3 h-3" />
          Update
        </button>
        <button
          onClick={() => insertPreset('call')}
          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-1"
        >
          <Phone className="w-3 h-3" />
          Call
        </button>
        <button
          onClick={() => insertPreset('quote')}
          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-1"
        >
          <DollarSign className="w-3 h-3" />
          Quote
        </button>
        <button
          onClick={() => insertPreset('shipping')}
          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-1"
        >
          <Truck className="w-3 h-3" />
          Shipping
        </button>
        <button
          onClick={() => insertPreset('waiting')}
          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-1"
        >
          <Clock className="w-3 h-3" />
          Waiting
        </button>
      </div>
      <div className="text-xs text-gray-500 mt-2">Ctrl+V to paste image, or drag & drop files</div>
    </div>
  );
};
