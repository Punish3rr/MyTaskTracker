// Reusable hook for subscribing to data-updated events from main process
import { useEffect } from 'react';

export function useDataUpdated(callback: () => void) {
  useEffect(() => {
    if (!window.electronAPI) return;
    
    const unsubscribe = window.electronAPI.onDataUpdated(callback);
    
    return unsubscribe;
  }, [callback]);
}
