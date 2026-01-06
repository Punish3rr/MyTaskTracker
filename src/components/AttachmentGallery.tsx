// Attachment gallery component with tabs and grid
import { useState, useMemo, useEffect } from 'react';
import { Image as ImageIcon, FileText, Image, File } from 'lucide-react';
import type { TimelineEntry } from '../../electron/preload';

interface AttachmentGalleryProps {
  timeline: TimelineEntry[];
  onSelectAttachment: (entry: TimelineEntry) => void;
  getAttachmentPath: (relativePath: string) => Promise<string>;
}

export const AttachmentGallery = ({ timeline, onSelectAttachment, getAttachmentPath }: AttachmentGalleryProps) => {
  const [activeTab, setActiveTab] = useState<'all' | 'images' | 'files'>('all');
  const [imageDataUrls, setImageDataUrls] = useState<Record<string, string>>({});

  const attachments = useMemo(() => {
    return timeline.filter(e => e.type === 'IMAGE' || e.type === 'FILE');
  }, [timeline]);

  const images = useMemo(() => {
    return attachments.filter(e => e.type === 'IMAGE');
  }, [attachments]);

  const files = useMemo(() => {
    return attachments.filter(e => e.type === 'FILE');
  }, [attachments]);

  const displayedAttachments = activeTab === 'all' ? attachments : activeTab === 'images' ? images : files;

  useEffect(() => {
    images.forEach(entry => {
      if (!imageDataUrls[entry.content]) {
        window.electronAPI.getImageDataUrl(entry.content).then(dataUrl => {
          if (dataUrl) {
            setImageDataUrls(prev => {
              // Only update if not already set (avoid unnecessary updates)
              if (prev[entry.content]) return prev;
              return { ...prev, [entry.content]: dataUrl };
            });
          }
        }).catch(err => {
          console.error('Failed to load image data URL:', err);
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images]);

  const getFileType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['pdf'].includes(ext)) return 'PDF';
    if (['doc', 'docx'].includes(ext)) return 'DOC';
    if (['xls', 'xlsx'].includes(ext)) return 'XLS';
    if (['zip', 'rar', '7z'].includes(ext)) return 'ZIP';
    return ext.toUpperCase() || 'FILE';
  };

  return (
    <div className="border-t border-gray-800 pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300">Attachments</h3>
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-2 py-1 text-xs rounded ${activeTab === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            All ({attachments.length})
          </button>
          <button
            onClick={() => setActiveTab('images')}
            className={`px-2 py-1 text-xs rounded ${activeTab === 'images' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            Images ({images.length})
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`px-2 py-1 text-xs rounded ${activeTab === 'files' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            Files ({files.length})
          </button>
        </div>
      </div>

      {displayedAttachments.length === 0 ? (
        <div className="text-center text-gray-500 text-sm py-8">No attachments</div>
      ) : (
        <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
          {displayedAttachments.map((entry) => {
            if (entry.type === 'IMAGE') {
              const filename = entry.content.split('/').pop() || '';
              const imageDataUrl = imageDataUrls[entry.content];
              
              return (
                <div
                  key={entry.id}
                  onClick={() => onSelectAttachment(entry)}
                  className="relative aspect-square bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all group"
                >
                  {imageDataUrl ? (
                    <img
                      src={imageDataUrl}
                      alt={filename}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-gray-500" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                </div>
              );
            } else {
              const filename = entry.content.split('/').pop() || '';
              const fileType = getFileType(filename);
              
              return (
                <div
                  key={entry.id}
                  onClick={() => onSelectAttachment(entry)}
                  className="p-2 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors border border-gray-700"
                >
                  <FileText className="w-6 h-6 text-gray-400 mb-1" />
                  <div className="text-xs text-gray-300 truncate" title={filename}>
                    {filename}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{fileType}</div>
                </div>
              );
            }
          })}
        </div>
      )}
    </div>
  );
};

