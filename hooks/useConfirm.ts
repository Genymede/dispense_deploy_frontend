import { useState, useCallback } from 'react';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  alertOnly?: boolean;
}

interface State {
  open: boolean;
  options: ConfirmOptions;
  resolve?: (v: boolean) => void;
}

export function useConfirm() {
  const [state, setState] = useState<State>({ open: false, options: { title: '' } });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      setState({ open: true, options, resolve });
    });
  }, []);

  const onConfirm = useCallback(() => {
    state.resolve?.(true);
    setState(s => ({ ...s, open: false }));
  }, [state]);

  const onCancel = useCallback(() => {
    state.resolve?.(false);
    setState(s => ({ ...s, open: false }));
  }, [state]);

  return {
    confirm,
    dialogProps: { open: state.open, ...state.options, onConfirm, onCancel },
  };
}
