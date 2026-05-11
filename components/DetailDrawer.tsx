'use client';
import { ReactNode, useEffect, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type DrawerWidth = 'sm' | 'md' | 'lg';

export const DrawerWidthCtx = createContext<DrawerWidth>('md');

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  width?: DrawerWidth;
  footer?: ReactNode;
}

const MAX_W: Record<DrawerWidth, string> = {
  sm: 'max-w-[680px]',
  md: 'max-w-[960px]',
  lg: 'max-w-[1280px]',
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
    <DrawerWidthCtx.Provider value={width}>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 animate-fade-in"
        onClick={onClose}
      >
        <div
          className={`relative w-full ${MAX_W[width]} bg-white rounded-2xl flex flex-col max-h-[92%]`}
          style={{
            borderTop: "3px solid var(--primary)",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06), 0 24px 64px rgba(0,0,0,0.12)",
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex-shrink-0 px-6 py-4 border-b border-slate-100 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-slate-800 leading-snug">{title}</h2>
              {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
            <button onClick={onClose}
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <X size={15} />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-4">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="flex-shrink-0 px-6 py-3.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2">
              {footer}
            </div>
          )}
        </div>
      </div>
    </DrawerWidthCtx.Provider>,
    document.body
  );
}

// ── Helper sub-components ─────────────────────────────────────────────────────

export function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      {title && <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">{title}</p>}
      {children}
    </div>
  );
}

export function DrawerGrid({ items }: {
  items: Array<{ label: string; value: ReactNode; span?: boolean }>
}) {
  const width = useContext(DrawerWidthCtx);
  const isLg = width === 'lg';
  const gridCls = isLg ? 'grid-cols-3' : 'grid-cols-2';
  const spanCls = isLg ? 'col-span-3' : 'col-span-2';

  return (
    <div className={`grid ${gridCls} gap-2`} style={isLg ? { gridAutoFlow: 'dense' } : undefined}>
      {items.map(({ label, value, span }, i) => (
        <div key={i} className={`bg-slate-50 rounded-xl px-3 py-2.5 ${span ? spanCls : ''}`}>
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
