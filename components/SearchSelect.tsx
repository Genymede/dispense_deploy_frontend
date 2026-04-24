'use client';
/**
 * SearchSelect — Autocomplete ค้นหาด้วยชื่อ แทน input ID ทั้งระบบ
 *
 * FIX: input เป็น uncontrolled ด้าน typing (internal state)
 *      parent รับ ID ผ่าน onSelect callback เท่านั้น
 *      initialDisplay ใช้ pre-fill ตอน edit แต่ไม่ block typing
 *      dropdown ใช้ position:fixed เพื่อหลีกเลี่ยง overflow:hidden ของ Modal
 */
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Search, X, Check, Loader2, ChevronDown } from 'lucide-react';

// helper: คำนวณสถานะ expiry สำหรับ subwarehouse item
function expiryStatus(expDate: string | null | undefined): 'expired' | 'critical' | 'warning' | 'ok' | null {
  if (!expDate) return null;
  const exp = new Date(expDate);
  const now = new Date();
  const daysLeft = Math.floor((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0)   return 'expired';
  if (daysLeft <= 30) return 'critical';
  if (daysLeft <= 90) return 'warning';
  return 'ok';
}

const EXPIRY_BADGE: Record<string, string> = {
  expired:  'bg-red-100 text-red-700',
  critical: 'bg-red-50 text-red-600',
  warning:  'bg-amber-50 text-amber-700',
  ok:       'bg-green-50 text-green-700',
};

export type SearchSelectType = 'patient' | 'drug' | 'user' | 'subwarehouse';

const ENDPOINTS: Record<SearchSelectType, string> = {
  patient:      '/registry/search/patients',
  drug:         '/registry/search/drugs',
  user:         '/auth/users',
  subwarehouse: '/drugs',
};
const Q_PARAM:    Record<SearchSelectType, string>  = { patient:'q', drug:'q', user:'q', subwarehouse:'search' };
const MIN_CHARS:  Record<SearchSelectType, number>  = { patient:2, drug:1, user:0, subwarehouse:1 };
const HINT:       Record<SearchSelectType, string>  = {
  patient:      'พิมพ์ชื่อ, HN, หรือเลขบัตร...',
  drug:         'พิมพ์ชื่อยา, ชื่อสามัญ, ชื่อการค้า...',
  user:         'พิมพ์ชื่อหรือ username...',
  subwarehouse: 'พิมพ์ชื่อยาในคลัง...',
};

function label(t: SearchSelectType, r: any): string {
  if (t === 'patient')      return r.full_name ?? `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim();
  if (t === 'drug')         return r.med_name ?? '';
  if (t === 'user')         return r.full_name ?? `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim();
  if (t === 'subwarehouse') return r.med_showname || r.med_name || '';
  return '';
}
function sublabel(t: SearchSelectType, r: any): string {
  if (t === 'patient')      return `HN: ${r.hn_number ?? '-'}${r.national_id ? ' · ' + r.national_id : ''}`;
  if (t === 'drug')         return [r.med_generic_name, r.unit ?? r.med_counting_unit, r.med_medical_category].filter(Boolean).join(' · ');
  if (t === 'user')         return `${r.username ?? ''} · ${r.role_name_th ?? ''}`;
  if (t === 'subwarehouse') return `คงเหลือ: ${r.current_stock ?? 0} ${r.unit ?? ''}${r.packaging_type ? ' · ' + r.packaging_type : ''}`;
  return '';
}

export interface SearchSelectProps {
  type: SearchSelectType;
  label?: string;
  required?: boolean;
  initialDisplay?: string;   // pre-fill text สำหรับ edit mode
  resetKey?: any;            // เปลี่ยนค่านี้เพื่อ reset (เช่น ตอนเปิด modal ใหม่)
  onSelect: (result: any | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function SearchSelect({
  type, label: labelText, required,
  initialDisplay = '', resetKey,
  onSelect, placeholder, disabled, className,
}: SearchSelectProps) {

  const [val,      setVal]      = useState(initialDisplay);
  const [results,  setResults]  = useState<any[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [open,     setOpen]     = useState(false);
  const [picked,   setPicked]   = useState<any | null>(null);

  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const prevReset = useRef(resetKey);

  // ── fixed-position dropdown (หลีกเลี่ยง modal overflow clipping) ──────────
  // คำนวณตำแหน่ง inline ตอน render เลย เพื่อไม่ให้เกิด flash จาก state update
  const getDropdownStyle = (): React.CSSProperties => {
    if (!wrapRef.current) return { position: 'fixed', zIndex: 9999 };
    const rect = wrapRef.current.getBoundingClientRect();
    return { position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 };
  };

  // reposition on scroll/resize while open
  const [, forceRepos] = useState(0);
  useEffect(() => {
    if (!open) return;
    const repos = () => forceRepos(n => n + 1);
    window.addEventListener('scroll', repos, true);
    window.addEventListener('resize', repos);
    return () => {
      window.removeEventListener('scroll', repos, true);
      window.removeEventListener('resize', repos);
    };
  }, [open]);

  // reset เมื่อ resetKey เปลี่ยน (เปิด modal ใหม่)
  useEffect(() => {
    if (resetKey !== prevReset.current) {
      prevReset.current = resetKey;
      setVal(initialDisplay ?? '');
      setPicked(null);
      setResults([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // sync initialDisplay สำหรับ edit mode (ครั้งแรก)
  useEffect(() => {
    setVal(initialDisplay ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDisplay]);

  // pre-load users
  useEffect(() => {
    if (type === 'user') fetch('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        // revert ถ้าพิมพ์ค้างแต่ไม่ได้เลือก
        if (picked) setVal(label(type, picked));
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [picked, type]);

  const fetch = async (q: string) => {
    if (q.length < MIN_CHARS[type] && type !== 'user') { setResults([]); return; }
    setLoading(true);
    try {
      const params: any = {};
      if (q) params[Q_PARAM[type]] = q;
      const res = await api.get(ENDPOINTS[type], { params });
      let data: any[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      if (type === 'user' && q) {
        const lq = q.toLowerCase();
        data = data.filter(u =>
          (u.full_name ?? '').toLowerCase().includes(lq) ||
          (u.username  ?? '').toLowerCase().includes(lq)
        );
      }
      setResults(data.slice(0, 20));
    } catch { setResults([]); }
    finally   { setLoading(false); }
  };

  // ── handlers ──────────────────────────────────────────────────────────────

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setVal(v);           // ← FIX: ต้องให้ input อัปเดตทันที
    setPicked(null);
    setOpen(true);
    clearTimeout(timerRef.current);
    if (v === '') { onSelect(null); setResults([]); return; }
    timerRef.current = setTimeout(() => fetch(v), 250);
  };

  const handleFocus = () => {
    setOpen(true);
    if (type === 'user' || val.length >= MIN_CHARS[type]) fetch(val);
  };

  const handlePick = (item: any) => {
    setPicked(item);
    setVal(label(type, item));
    setResults([]);
    setOpen(false);
    onSelect(item);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPicked(null);
    setVal('');
    setResults([]);
    setOpen(false);
    onSelect(null);
    inputRef.current?.focus();
  };

  return (
    <div ref={wrapRef} className={`relative ${className ?? ''}`}>

      {labelText && (
        <label className="block text-xs font-medium text-slate-700 mb-1.5">
          {labelText}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* input box */}
      <div className={[
        'flex items-center rounded-lg border transition-colors',
        open && !disabled ? 'border-primary-500 ring-2 ring-primary-100' : 'border-slate-200 hover:border-slate-300',
        disabled ? 'bg-slate-50 opacity-60 cursor-not-allowed' : 'bg-white',
      ].join(' ')}>
        <Search size={14} className="absolute ml-3 text-slate-400 pointer-events-none flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          value={val}
          onChange={handleChange}
          onFocus={handleFocus}
          placeholder={placeholder ?? HINT[type]}
          disabled={disabled}
          className="w-full h-9 pl-9 pr-9 text-sm bg-transparent outline-none text-slate-800 placeholder-slate-400"
        />
        <div className="absolute right-2.5 flex items-center gap-1 pointer-events-none">
          {loading && <Loader2 size={13} className="animate-spin text-slate-400 pointer-events-none" />}
          {!loading && picked && <Check size={13} className="text-green-500" />}
          {!loading && !picked && type === 'user' && <ChevronDown size={13} className="text-slate-400" />}
          {!loading && picked && (
            <button type="button" onClick={handleClear}
              className="text-slate-400 hover:text-red-500 transition-colors pointer-events-auto">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* dropdown — position:fixed เพื่อหลุดจาก overflow:hidden ของ Modal */}
      {open && !disabled && (
        <div style={getDropdownStyle()} className="bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          {loading && results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> กำลังค้นหา...
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">
              {val.length < MIN_CHARS[type]
                ? `พิมพ์อย่างน้อย ${MIN_CHARS[type]} ตัวอักษรเพื่อค้นหา`
                : `ไม่พบรายการ "${val}"`}
            </p>
          ) : (
            <ul className="max-h-60 overflow-y-auto py-1" role="listbox">
              {results.map((item, i) => {
                const lbl = label(type, item);
                const sub = sublabel(type, item);
                const active = picked && label(type, picked) === lbl;

                // expiry badge สำหรับ subwarehouse
                const expDate = type === 'subwarehouse' ? (item.nearest_lot_exp ?? item.exp_date) : null;
                const expStatus = expiryStatus(expDate);
                const expLabel = expDate
                  ? new Date(expDate).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' })
                  : null;

                return (
                  <li key={i} role="option" aria-selected={!!active}>
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); handlePick(item); }}
                      className={[
                        'w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors',
                        active ? 'bg-primary-50' : 'hover:bg-slate-50',
                      ].join(' ')}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-medium truncate ${active ? 'text-primary-700' : 'text-slate-800'}`}>
                            {lbl}
                          </p>
                          {expStatus && expLabel && (
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${EXPIRY_BADGE[expStatus]}`}>
                              {expStatus === 'expired' ? '⛔ หมดอายุ' : `หมด ${expLabel}`}
                            </span>
                          )}
                        </div>
                        {sub && <p className="text-xs text-slate-400 truncate mt-0.5">{sub}</p>}
                      </div>
                      {active && <Check size={14} className="text-primary-500 flex-shrink-0 mt-0.5" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
