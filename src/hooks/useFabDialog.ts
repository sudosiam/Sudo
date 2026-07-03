import * as React from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Opens page dialogs from floating shortcuts using `?new=1`.
 * Also clears the query param on close so the shortcut can reopen reliably.
 */
export function useFabDialog(param = 'new') {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get(param) === '1';
  const [open, setOpen] = React.useState(requested);

  React.useEffect(() => {
    if (requested) setOpen(true);
  }, [requested]);

  const closeDialog = React.useCallback(() => {
    setOpen(false);
    if (!requested) return;
    const next = new URLSearchParams(searchParams);
    next.delete(param);
    setSearchParams(next, { replace: true });
  }, [param, requested, searchParams, setSearchParams]);

  const openDialog = React.useCallback(() => {
    setOpen(true);
  }, []);

  return {
    open,
    setOpen,
    requested,
    openDialog,
    closeDialog,
  };
}
