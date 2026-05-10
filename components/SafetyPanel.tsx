'use client';
import { useEffect, useState } from 'react';
import { safetyApi, type SafetyCheckResult, type SafetyAlert } from '@/lib/api';
import { Loader2, ShieldCheck, ShieldAlert, ShieldX, Info } from 'lucide-react';

interface Props {
  prescriptionId: number;
  onLoaded?: (result: SafetyCheckResult) => void;
  overrideAlerts?: SafetyAlert[];
}

const LEVEL_CFG = {
  critical: {
    icon: ShieldX,
    iconCls: 'text-red-600',
    chip: 'bg-red-100 text-red-700 border-red-200',
  },
  warning: {
    icon: ShieldAlert,
    iconCls: 'text-amber-600',
    chip: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  info: {
    icon: Info,
    iconCls: 'text-blue-500',
    chip: 'bg-blue-100 text-blue-700 border-blue-200',
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

export default function SafetyPanel({ prescriptionId, onLoaded, overrideAlerts }: Props) {
  const [result, setResult] = useState<SafetyCheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!prescriptionId) return;
    setLoading(true); setError(''); setResult(null);
    safetyApi.check(prescriptionId)
      .then(r => { setResult(r.data); onLoaded?.(r.data); })
      .catch(e => setError(e.message || 'ตรวจสอบไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, [prescriptionId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 size={14} className="animate-spin text-primary-500" />
        กำลังตรวจสอบความปลอดภัย...
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-slate-500">⚠ {error}</p>;
  }

  if (!result) return null;

  const displayAlerts = overrideAlerts ?? result.alerts;
  const displayLevel = overrideAlerts != null
    ? (displayAlerts.some(a => a.level === 'critical') ? 'critical'
      : displayAlerts.some(a => a.level === 'warning') ? 'warning' : 'safe')
    : result.alert_level;

  const isSafe = displayLevel === 'safe';
  const isCritical = displayLevel === 'critical';

  const sorted = displayAlerts
    .slice()
    .sort((a, b) =>
      (a.level === 'critical' ? 0 : a.level === 'warning' ? 1 : 2) -
      (b.level === 'critical' ? 0 : b.level === 'warning' ? 1 : 2)
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Status chip */}
      <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full ${
        isSafe    ? 'bg-green-100 text-green-800' :
        isCritical ? 'bg-red-100 text-red-800' :
                    'bg-amber-100 text-amber-800'
      }`}>
        {isSafe
          ? <ShieldCheck size={14} />
          : isCritical
            ? <ShieldX size={14} />
            : <ShieldAlert size={14} />}
        {isSafe ? 'ปลอดภัย' : isCritical ? 'มีปัญหา' : 'ควรระวัง'}
      </span>

      {/* Alert chips — one per alert, all in the same row */}
      {sorted.map((alert, i) => {
        const cfg = LEVEL_CFG[alert.level];
        const Icon = cfg.icon;
        return (
          <span
            key={i}
            className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.chip}`}
          >
            <Icon size={11} className={cfg.iconCls} />
            {TYPE_LABEL[alert.type]}: {alert.title}
          </span>
        );
      })}
    </div>
  );
}
