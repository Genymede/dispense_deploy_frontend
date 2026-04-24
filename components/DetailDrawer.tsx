'use client';
/**
 * DetailDrawer — Slide-in drawer แสดงรายละเอียดของรายการ
 * ใช้กับทุก registry table เพื่อดูรายละเอียดโดยไม่ต้องเปิดหน้าใหม่
 */
import { ReactNode, useEffect, useRef } from 'react';
import { X, ExternalLink } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  width?: 'sm' | 'md' | 'lg';
  footer?: ReactNode;
}

const WIDTH = {
  sm: 'w-[380px]',
  md: 'w-[520px]',
  lg: 'w-[680px]',
};

export default function DetailDrawer({
  open, onClose, title, subtitle, children, width = 'md', footer,
}: Props) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);

  // Prevent background scroll when open — lock the nearest scroll container (main)
  useEffect(() => {
    const el = document.querySelector('main') as HTMLElement | null;
    if (!el) return;
    if (open) el.style.overflow = 'hidden';
    else el.style.overflow = '';
    return () => { el.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ left: 'var(--sidebar-w)' }}
        className={`fixed top-14 bottom-0 right-0 bg-black/25 z-40 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed top-14 bottom-0 right-0 ${WIDTH[width]} bg-white shadow-2xl z-50 flex flex-col
          transform transition-transform duration-300 ease-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
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
    </>
  );
}

// ── Helper sub-components ─────────────────────────────────────────────────────

/** Section header */
export function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">{title}</p>
      {children}
    </div>
  );
}

/** Key-value grid */
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

/** Inline badge row */
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
