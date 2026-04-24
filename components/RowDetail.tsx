'use client';
/**
 * RowDetail — Slide-in drawer แสดงรายละเอียดแถว
 * ใช้ pattern ที่ปลอดภัย: ทุก field รับ row เป็น prop ตรงๆ
 * ไม่มีการ patch หรือ script generate — เขียนด้วยมือทั้งหมด
 */
import { ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface Field {
  label: string;
  value: ReactNode;
  wide?: boolean; // span full width
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  fields: Field[];
  footer?: ReactNode;
}

export default function RowDetail({ open, onClose, title, subtitle, fields, footer }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* backdrop */}
      <div
        style={{ left: 'var(--sidebar-w)' }}
        className={`fixed top-14 bottom-0 right-0 bg-black/25 z-40 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      {/* drawer */}
      <div
        ref={ref}
        className={`fixed top-14 bottom-0 right-0 w-[520px] max-w-full bg-white shadow-2xl z-50 flex flex-col
          transform transition-transform duration-300 ease-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* header */}
        <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-slate-800 text-base leading-snug truncate">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button onClick={onClose}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            {fields.map((field, i) => (
              <div key={i} className={`bg-slate-50 rounded-xl px-3.5 py-3 ${field.wide ? 'col-span-2' : ''}`}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  {field.label}
                </p>
                <div className="text-sm text-slate-800 break-words">
                  {field.value ?? <span className="text-slate-300">—</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* footer */}
        {footer && (
          <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
