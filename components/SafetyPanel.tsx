'use client';
/**
 * SafetyPanel — แสดงผลการตรวจความปลอดภัยของยา
 * ใช้ใน dispense modal ก่อนจ่ายยา
 */
import { useEffect, useState } from 'react';
import { safetyApi, type SafetyCheckResult, type SafetyAlert } from '@/lib/api';
import { Loader2, ShieldCheck, ShieldAlert, ShieldX, ChevronDown, ChevronUp, Pill, AlertTriangle, Info } from 'lucide-react';

interface Props {
  prescriptionId: number;
  onLoaded?: (result: SafetyCheckResult) => void;
  /** ถ้าส่งมา จะ override alerts ที่ fetch มา (ใช้ filter stock alerts ที่ mark เป็น overdue แล้ว) */
  overrideAlerts?: SafetyAlert[];
}

const LEVEL_CFG = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: ShieldX,
    iconCls: 'text-red-600',
    title: 'text-red-800',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-700',
    dot: 'bg-red-500',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: ShieldAlert,
    iconCls: 'text-amber-600',
    title: 'text-amber-800',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-400',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: Info,
    iconCls: 'text-blue-500',
    title: 'text-blue-800',
    text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-700',
    dot: 'bg-blue-400',
  },
};

const TYPE_LABEL: Record<SafetyAlert['type'], string> = {
  allergy: 'แพ้ยา',
  adr: 'ADR',
  interaction: 'ปฏิกิริยายา',
  stock: 'สต็อก',
  expired: 'หมดอายุ',
  narcotic: 'ยาเสพติด',
  pregnancy: 'ตั้งครรภ์',
};

function AlertCard({ alert }: { alert: SafetyAlert }) {
  const [expanded, setExpanded] = useState(alert.level === 'critical');
  const cfg = LEVEL_CFG[alert.level];
  const Icon = cfg.icon;

  return (
    <div className={`rounded-xl border ${cfg.bg} ${cfg.border} overflow-hidden transition-all`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left"
      >
        <Icon size={16} className={`${cfg.iconCls} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold ${cfg.title}`}>{alert.title}</span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cfg.badge}`}>
              {TYPE_LABEL[alert.type]}
            </span>
          </div>
          {!expanded && (
            <p className={`text-xs ${cfg.text} truncate mt-0.5`}>{alert.detail}</p>
          )}
        </div>
        <span className={`text-xs ${cfg.iconCls} flex-shrink-0 mt-1`}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {expanded && (
        <div className={`px-4 pb-3 border-t ${cfg.border} pt-2.5`}>
          <p className={`text-sm ${cfg.text}`}>{alert.detail}</p>
          {alert.note && (
            <p className={`text-xs ${cfg.text} opacity-75 mt-1`}>{alert.note}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function SafetyPanel({ prescriptionId, onLoaded, overrideAlerts }: Props) {
  const [result, setResult] = useState<SafetyCheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!prescriptionId) return;
    setLoading(true); setError(''); setResult(null);
    safetyApi.check(prescriptionId)
      .then(r => {
        setResult(r.data);
        onLoaded?.(r.data);
      })
      .catch(e => setError(e.message || 'ตรวจสอบไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, [prescriptionId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-5 text-sm text-slate-500">
        <Loader2 size={16} className="animate-spin text-primary-500" />
        กำลังตรวจสอบความปลอดภัย...
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-500">
        ⚠ {error}
      </div>
    );
  }

  if (!result) return null;

  // ถ้ามี overrideAlerts ให้ใช้แทน + คำนวณ level ใหม่
  const displayAlerts = overrideAlerts ?? result.alerts;
  const displayLevel = overrideAlerts != null
    ? (displayAlerts.some(a => a.level === 'critical') ? 'critical'
      : displayAlerts.some(a => a.level === 'warning') ? 'warning' : 'safe')
    : result.alert_level;

  const isSafe = displayLevel === 'safe';
  const isCritical = displayLevel === 'critical';

  return (
    <div className="space-y-3">
      {/* ── Header summary ── */}
      <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${isSafe ? 'bg-green-50 border-green-200' :
          isCritical ? 'bg-red-50 border-red-200' :
            'bg-amber-50 border-amber-200'
        }`}>
        {isSafe
          ? <ShieldCheck size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
          : isCritical
            ? <ShieldX size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            : <ShieldAlert size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
        }
        <div className="flex-1">
          <p className={`font-semibold text-sm ${isSafe ? 'text-green-800' : isCritical ? 'text-red-800' : 'text-amber-800'
            }`}>
            {isSafe
              ? '✓ ผ่านการตรวจความปลอดภัย — ไม่พบปัญหา'
              : isCritical
                ? `⛔ พบปัญหาร้ายแรง ${displayAlerts.filter(a => a.level === 'critical').length} รายการ — ตรวจสอบก่อนจ่ายยา`
                : `⚠ พบข้อควรระวัง ${displayAlerts.length} รายการ`
            }
          </p>

          {/* Patient info */}
          <div className="flex flex-wrap gap-3 mt-2">
            {result.blood_group && (
              <span className="text-xs text-slate-600">
                🩸 กรุ๊ปเลือด: <strong>{result.blood_group}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Alert cards ── */}
      {displayAlerts.length > 0 && (
        <div className="space-y-2">
          {/* Critical first */}
          {displayAlerts
            .slice()
            .sort((a, b) =>
              (a.level === 'critical' ? 0 : a.level === 'warning' ? 1 : 2) -
              (b.level === 'critical' ? 0 : b.level === 'warning' ? 1 : 2)
            )
            .map((alert, i) => (
              <AlertCard key={i} alert={alert} />
            ))
          }
        </div>
      )}

    </div>
  );
}
