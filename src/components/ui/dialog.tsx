import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Full-viewport form layout (matches sale/purchase form pages on mobile). */
  fullPage?: boolean;
}

/**
 * Modal dialog. `fullPage` fills the screen on mobile (form pages);
 * default is a compact bottom sheet / centered card (confirm prompts).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
  fullPage = false,
}: DialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex justify-center',
        fullPage ? 'items-stretch sm:items-center' : 'items-end sm:items-center',
      )}
    >
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[3px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 flex w-full flex-col overflow-hidden border shadow-2xl',
          fullPage
            ? 'h-dvh max-h-dvh bg-background sm:mx-auto sm:h-auto sm:max-h-[92dvh] sm:max-w-lg sm:rounded-2xl sm:border-border sm:bg-card'
            : 'max-h-[92dvh] rounded-t-3xl border-border bg-card sm:max-w-lg sm:rounded-2xl',
          className,
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b px-4 py-3.5 sm:px-5">
          <div>
            {title && <h2 className="text-base font-semibold tracking-tight sm:text-sm">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-5 sm:size-4" />
          </button>
        </div>
        <div className={cn('overflow-y-auto p-4 sm:p-5', fullPage && 'flex-1')}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** Simple confirm dialog helper */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Delete',
  destructive = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="h-9 rounded-xl border bg-card px-4 text-sm font-semibold hover:bg-accent"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={cn(
            'h-9 rounded-xl px-4 text-sm font-semibold text-white',
            destructive ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90',
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
