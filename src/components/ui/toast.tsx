import { X, AlertCircle } from 'lucide-react';
import { useToast } from '../../stores/toast';
import { cn } from '../../lib/utils';

export function ToastHost() {
  const { toasts, dismiss } = useToast();

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex max-w-md items-start gap-2 rounded-xl border px-3.5 py-2.5 text-xs shadow-lg backdrop-blur-md',
            t.tone === 'error' && 'border-destructive/40 bg-destructive/95 text-destructive-foreground',
            t.tone === 'success' && 'border-success/40 bg-success/95 text-success-foreground',
            t.tone === 'info' && 'border-border bg-popover/95 text-popover-foreground',
          )}
          role="alert"
        >
          {t.tone === 'error' && <AlertCircle className="mt-0.5 size-4 shrink-0" />}
          <p className="min-w-0 flex-1 whitespace-pre-wrap leading-relaxed">{t.message}</p>
          <button
            type="button"
            className="shrink-0 rounded-lg p-0.5 opacity-70 hover:opacity-100"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
