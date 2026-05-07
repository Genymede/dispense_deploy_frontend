'use client';
import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  width?: 'sm' | 'md' | 'lg';
  footer?: ReactNode;
}

const MAX_W = {
  sm: 'max-w-[440px]',
  md: 'max-w-[580px]',
  lg: 'max-w-[740px]',
};

export default function DetailDrawer({
  open, onClose, title, subtitle, children, width = 'md', footer,
}: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open || typeof window === 'undefined') return null;

  return createPortal(
    <div
      style={{ left: 'var(--sidebar-w)', top: '64px' }}
      className="fixed bottom-0 right-0 z-50 flex items-center justify-center p-6 bg-black/30 animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`relative w-full ${MAX_W[width]} bg-white rounded-2xl shadow-2xl flex flex-col max-h-full`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-slate-800 text-base leading-snug">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ── Helper sub-components ─────────────────────────────────────────────────────

export function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">{title}</p>
      {children}
    </div>
  );
}

export function DrawerGrid({ items }: {
  items: Array<{ label: string; value: ReactNode; span?: boolean }>
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(({ label, value, span }, i) => (
        <div key={i} className={`bg-slate-50 rounded-xl px-3 py-2.5 ${span ? 'col-span-2' : ''}`}>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
          <div className="text-sm font-medium text-slate-800 break-words">
            {value ?? <span className="text-slate-300">—</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DrawerBadgeRow({ items }: {
  items: Array<{ label: string; color?: string }>
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(({ label, color = 'bg-slate-100 text-slate-600' }, i) => (
        <span key={i} className={`text-xs font-medium px-2.5 py-1 rounded-full ${color}`}>
          {label}
        </span>
      ))}
    </div>
  );
}
