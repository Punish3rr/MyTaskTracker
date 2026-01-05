// Toast notification wrapper using sonner
import { Toaster as SonnerToaster } from 'sonner';

export const Toaster = () => {
  return <SonnerToaster position="top-right" richColors />;
};

export { toast } from 'sonner';
