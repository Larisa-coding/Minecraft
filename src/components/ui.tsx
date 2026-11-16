import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useUi } from '../store/uiStore';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'sand' | 'danger'; small?: boolean };

export const Button = ({ variant = 'primary', small, className, ...props }: ButtonProps) => (
  <button className={['btn', variant !== 'primary' ? variant : '', small ? 'small' : '', className ?? ''].filter(Boolean).join(' ')} {...props} />
);

export const Modal = ({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) => (
  <div className="modal-back" role="dialog" aria-modal="true" aria-label={title} onMouseDown={onClose}>
    <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <h2 style={{ fontSize: 22 }}>{title}</h2>
        <Button variant="ghost" small onClick={onClose} aria-label="Закрыть">Закрыть</Button>
      </div>
      {children}
    </div>
  </div>
);

export const Slider = ({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (value: number) => void }) => (
  <label className="field">
    {label}: {Math.round(value * 100) / 100}
    <input className="slider" type="range" min={min} max={max} step={step} value={value} aria-label={label} onChange={(event) => onChange(Number(event.target.value))} />
  </label>
);

export const LoadingScreen = ({ label, progress }: { label: string; progress: number }) => (
  <div className="loading" role="status">
    <div className="panel">
      <h2>Mosspeak</h2>
      <p className="sub">{label}</p>
      <div className="bar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
        <span style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
    </div>
  </div>
);

export const Notifications = () => {
  const toasts = useUi((state) => state.toasts);
  const dismiss = useUi((state) => state.dismissToast);
  useEffect(() => {
    const timers = toasts.map((toast) => window.setTimeout(() => dismiss(toast.id), 2400));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [toasts, dismiss]);
  return (
    <div className="toasts">
      {toasts.map((toast) => <div className="toast" key={toast.id}>{toast.text}</div>)}
    </div>
  );
};

export const ConfirmHost = () => {
  const confirm = useUi((state) => state.confirm);
  const close = useUi((state) => state.closeConfirm);
  if (!confirm) return null;
  return (
    <Modal title={confirm.title} onClose={close}>
      <p>{confirm.text}</p>
      <div className="row">
        <Button variant="danger" onClick={() => { confirm.onConfirm(); close(); }}>{confirm.confirmLabel}</Button>
        <Button variant="ghost" onClick={close}>Отмена</Button>
      </div>
    </Modal>
  );
};
