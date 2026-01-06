// Toast notifications using sonner
import { toast as sonnerToast, Toaster as SonnerToaster } from 'sonner';

export const toast = {
  success: (message: string) => sonnerToast.success(message),
  error: (message: string) => sonnerToast.error(message),
  info: (message: string) => sonnerToast.info(message),
  warning: (message: string) => sonnerToast.warning(message),
};

export const Toaster = () => (
  <SonnerToaster 
    position='top-right'
    toastOptions={{
      style: {
        background: 'rgba(31, 41, 55, 0.95)',
        border: '1px solid rgba(75, 85, 99, 0.5)',
        color: '#f3f4f6',
        backdropFilter: 'blur(8px)',
      },
    }}
  />
);
