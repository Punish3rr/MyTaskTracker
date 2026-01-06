// Attachment gallery component with memoization to prevent flickering
import React, { useMemo, useState, useEffect } from 'react';
import { Image as ImageIcon, FileText } from 'lucide-react';
import type { TimelineEntry } from '../../electron/preload';

interface AttachmentGalleryProps {
  timeline: TimelineEntry[];
  onSelectAttachment: (entry: TimelineEntry) => void;
  getAttachmentPath: (relativePath: string) => Promise<string>;
}

export const AttachmentGallery = React.memo(({ timeline, onSelectAttachment, getAttachmentPath }: AttachmentGalleryProps) => {
  const attachmentEntries = useMemo(() => 
    timeline.filter(e => e.type === 'IMAGE' || e.type === 'FILE'),
    [timeline]
  );

  const [imageDataUrls, setImageDataUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const imageEntries = attachmentEntries.filter(e => e.type === 'IMAGE');
    const loadImages = async () => {
      const newDataUrls: Record<string, string> = {};
      for (const entry of imageEntries) {
        if (!imageDataUrls[entry.content] && entry.content) {
          try {
            const dataUrl = await window.electronAPI.getImageDataUrl(entry.content);
            if (dataUrl) {
              newDataUrls[entry.content] = dataUrl;
            }
          } catch (error) {
            console.error('Failed to load image preview:', error);
          }
        }
      }
      if (Object.keys(newDataUrls).length > 0) {
        setImageDataUrls(prev => ({ ...prev, ...newDataUrls }));
      }
    };
    if (imageEntries.length > 0) {
      loadImages();
    }
  }, [attachmentEntries, imageDataUrls]);

  if (attachmentEntries.length === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-4">
        No attachments yet
      </div>
    );
  }

  const displayEntries = attachmentEntries.slice(-12).reverse();

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-gray-300 mb-3">Attachments ({attachmentEntries.length})</div>
      <div className="grid grid-cols-3 gap-2">
        {displayEntries.map((entry) => {
          if (entry.type === 'IMAGE') {
            const dataUrl = imageDataUrls[entry.content];
            return (
              <div
                key={entry.id}
                onClick={() => onSelectAttachment(entry)}
                className="relative aspect-square rounded-lg overflow-hidden border border-gray-700/50 hover:border-blue-500/50 cursor-pointer transition-colors bg-gray-800/40"
                title="Click to scroll to entry"
              >
                {dataUrl ? (
                  <img
                    src={dataUrl}
                    alt="Attachment"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-800/60">
                    <ImageIcon className="w-6 h-6 text-gray-500" />
                  </div>
                )}
              </div>
            );
          } else {
            const fileName = entry.content.split('/').pop() || 'File';
            return (
              <div
                key={entry.id}
                onClick={() => onSelectAttachment(entry)}
                className="flex flex-col items-center justify-center p-2 rounded-lg border border-gray-700/50 hover:border-blue-500/50 cursor-pointer transition-colors bg-gray-800/40 min-h-[60px]"
                title={`${fileName} - Click to scroll to entry`}
              >
                <FileText className="w-5 h-5 text-gray-400 mb-1" />
                <span className="text-xs text-gray-500 truncate w-full text-center">{fileName}</span>
              </div>
            );
          }
        })}
      </div>
    </div>
  );
});

AttachmentGallery.displayName = 'AttachmentGallery';
