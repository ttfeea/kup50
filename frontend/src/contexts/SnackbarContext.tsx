import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

type SnackbarTone = 'success' | 'error' | 'warning';

type Snackbar = {
  id: number;
  key: string;
  message: string;
  tone: SnackbarTone;
};

type SnackbarContextValue = {
  showSnackbar: (message: string, tone: SnackbarTone) => void;
};

const SnackbarContext = createContext<SnackbarContextValue | undefined>(
  undefined,
);

const toneStyles: Record<SnackbarTone, string> = {
  success: 'border-green-500/40 bg-green-600 text-white',
  error: 'border-red-500/40 bg-red-600 text-white',
  warning: 'border-amber-400/50 bg-amber-500 text-slate-950',
};

export function SnackbarProvider({ children }: PropsWithChildren) {
  const [snackbars, setSnackbars] = useState<Snackbar[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setSnackbars((current) => current.filter((item) => item.id !== id));
  }, []);

  const showSnackbar = useCallback(
    (message: string, tone: SnackbarTone) => {
      const trimmedMessage = message.trim();
      if (!trimmedMessage) {
        return;
      }

      const key = `${tone}:${trimmedMessage}`;
      setSnackbars((current) => {
        if (current.some((item) => item.key === key)) {
          return current;
        }

        const snackbar = {
          id: nextId.current++,
          key,
          message: trimmedMessage,
          tone,
        };

        const delay =
          tone === 'error' ? 7000 : tone === 'warning' ? 6000 : 4500;
        timers.current.set(
          snackbar.id,
          setTimeout(() => dismiss(snackbar.id), delay),
        );

        return [...current, snackbar].slice(-3);
      });
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showSnackbar }), [showSnackbar]);

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 sm:right-6 sm:top-6">
        {snackbars.map((snackbar) => (
          <button
            key={snackbar.id}
            type="button"
            onClick={() => dismiss(snackbar.id)}
            className={`rounded-lg border px-4 py-3 text-left text-sm font-medium shadow-2xl ${toneStyles[snackbar.tone]}`}
          >
            {snackbar.message}
          </button>
        ))}
      </div>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  const context = useContext(SnackbarContext);

  if (!context) {
    throw new Error('useSnackbar must be used within SnackbarProvider');
  }

  return context;
}
