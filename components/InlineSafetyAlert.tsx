'use client';
/**
 * InlineSafetyAlert — แสดงการแจ้งเตือนยา real-time ขณะสร้าง/แก้ไขใบสั่งยา
 * โหลดอัตโนมัติทุกครั้งที่ patient_id หรือ med_sids เปลี่ยน
 */
import { useEffect, useRef, useState } from 'react';
import { safetyApi, type SafetyCheckResult, type SafetyAlert } from '@/lib/api';
import { ShieldCheck, ShieldAlert, ShieldX, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  patientId: number | null;
  medSids:   number[];
  className?: string;
}

const TYPE_ICON: Record<SafetyAlert['type'], string> = {
  allergy: '⚠', adr: '🔬', interaction: '💊',
  stock: '📦', expired: '🚫', narcotic: '📋', pregnancy: '🤰',
};

const LEVEL_STYLE = {
  critical: { bar: 'bg-red-50 border-red-300',   dot: 'bg-red-500',   text: 'text-red-800',   sub: 'text-red-600'   },
  warning:  { bar: 'bg-amber-50 border-amber-300', dot: 'bg-amber-400', text: 'text-amber-800', sub: 'text-amber-600' },
  info:     { bar: 'bg-blue-50 border-blue-200',   dot: 'bg-blue-400',  text: 'text-blue-800',  sub: 'text-blue-600'  },
};

export default function InlineSafetyAlert({ patientId, medSids, className }: Props) {
  const [result,  setResult]  = useState<SafetyCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const prevKey  = useRef('');

  useEffect(() => {
    const key = `${patientId}|${[...medSids].sort().join(',')}`;
    if (key === prevKey.current) return;
    prevKey.current = key;

    if (medSids.length === 0) { setResult(null); return; }

    clearTimeout(timerRef.current);
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await safetyApi.checkInline(patientId, medSids);
        setResult(res.data);
        // auto-expand when new critical alert appears
        if (res.data.alert_level === 'critical') setExpanded(true);
      } catch { /* silent */ }
      finally { setLoading(false); }
    }, 600); // debounce 600ms
  }, [patientId, medSids]);

  if (medSids.length === 0 && !result) return null;

  // loading state
  if (loading) return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500 ${className}`}>
      <Loader2 size={14} className="animate-spin text-primary-400" />
      กำลังตรวจสอบความปลอดภัย...
    </div>
  );

  if (!result) return null;

  const { alert_level, alerts } = result;
  const isSafe = alert_level === 'safe';

  if (isSafe) return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-green-200 bg-green-50 text-sm text-green-700 ${className}`}>
      <ShieldCheck size={15} className="text-green-600 flex-shrink-0" />
      <span className="font-medium">ผ่านการตรวจ — ไม่พบปัญหา</span>
    </div>
  );

  const criticals = alerts.filter(a => a.level === 'critical');
  const warnings  = alerts.filter(a => a.level === 'warning');
  const infos     = alerts.filter(a => a.level === 'info');

  const SummaryIcon = alert_level === 'critical' ? ShieldX : ShieldAlert;
  const summaryStyle = alert_level === 'critical'
    ? 'border-red-300 bg-red-50 text-red-800'
    : 'border-amber-300 bg-amber-50 text-amber-800';
  const iconCls = alert_level === 'critical' ? 'text-red-600' : 'text-amber-600';

  return (
    <div className={`rounded-xl border overflow-hidden ${summaryStyle} ${className}`}>
      {/* Header — always visible */}
      <button type="button" onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
        <SummaryIcon size={15} className={`${iconCls} flex-shrink-0`} />
        <span className="text-sm font-semibold flex-1">
          {alert_level === 'critical'
            ? `⛔ พบปัญหาร้ายแรง ${criticals.length} รายการ${warnings.length ? ` · ข้อควรระวัง ${warnings.length}` : ''}`
            : `⚠ ข้อควรระวัง ${warnings.length} รายการ${infos.length ? ` · ข้อมูล ${infos.length}` : ''}`
          }
        </span>
        {expanded ? <ChevronUp size={13} className={iconCls} /> : <ChevronDown size={13} className={iconCls} />}
      </button>

      {/* Alert list */}
      {expanded && (
        <div className="border-t border-current border-opacity-20 divide-y divide-current divide-opacity-10">
          {[...criticals, ...warnings, ...infos].map((a, i) => {
            const s = LEVEL_STYLE[a.level];
            return (
              <div key={i} className={`px-3 py-2 flex items-start gap-2 ${s.bar}`}>
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${s.text}`}>{a.title}</p>
                  {a.detail && <p className={`text-xs ${s.sub} mt-0.5`}>{a.detail}</p>}
                  {a.note && a.note !== a.detail && (
                    <p className={`text-[10px] ${s.sub} opacity-75 mt-0.5`}>{a.note}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
