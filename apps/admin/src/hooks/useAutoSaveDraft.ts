import { useState, useEffect } from 'react';

export function useAutoSaveDraft<T>(key: string, initialData: T) {
  const [data, setData] = useState<T>(initialData);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  // Auto-save to localStorage every 30 seconds
  useEffect(() => {
    if (!data) return;
    const timer = setInterval(() => {
      try {
        localStorage.setItem(`draft_${key}`, JSON.stringify({ data, timestamp: Date.now() }));
      } catch (e) {
        console.error('Failed to auto-save draft:', e);
      }
    }, 30000); // 30s

    return () => clearInterval(timer);
  }, [key, data]);

  const restoreDraft = (): T | null => {
    try {
      const stored = localStorage.getItem(`draft_${key}`);
      if (stored) {
        const { data: savedData } = JSON.parse(stored);
        setData(savedData);
        setHasRestoredDraft(true);
        return savedData;
      }
    } catch (e) {
      console.error('Failed to restore draft:', e);
    }
    return null;
  };

  const clearDraft = () => {
    localStorage.removeItem(`draft_${key}`);
    setHasRestoredDraft(false);
  };

  return { data, setData, restoreDraft, clearDraft, hasRestoredDraft };
}
