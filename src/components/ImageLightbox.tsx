// Full-screen image lightbox modal
import { X, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ImageLightboxProps {
  imagePath: string; // Can be data URL or relative path
  onClose: () => void;
  onOpenExternal?: () => void;
}

export const ImageLightbox = ({ imagePath, onClose, onOpenExternal }: ImageLightboxProps) => {
  const [imageSrc, setImageSrc] = useState<string>('');

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  useEffect(() => {
    // If it's already a data URL, use it directly
    if (imagePath.startsWith('data:')) {
      setImageSrc(imagePath);
    } else {
      // Otherwise, load it as data URL
      window.electronAPI.getImageDataUrl(imagePath).then(dataUrl => {
        if (dataUrl) setImageSrc(dataUrl);
      }).catch(err => {
        console.error('Failed to load image for lightbox:', err);
      });
    }
  }, [imagePath]);

  if (!imageSrc) {
    return (
      <div 
        className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
        onClick={onClose}
      >
        <div className="text-gray-400">Loading image...</div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="relative max-w-[90vw] max-h-[90vh]">
        <img
          src={imageSrc}
          alt="Preview"
          className="max-w-full max-h-[90vh] object-contain"
          onClick={(e) => e.stopPropagation()}
        />
        <div className="absolute top-4 right-4 flex gap-2">
          {onOpenExternal && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenExternal();
              }}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              title="Open in external viewer"
            >
              <ExternalLink className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

