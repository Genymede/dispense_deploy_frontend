'use client';
import { useEffect, useState, useCallback } from 'react';
import MainLayout from '@/components/MainLayout';
import { Card, Badge, Button, EmptyState, Spinner } from '@/components/ui';
import { alertApi, type Alert } from '@/lib/api';
import { Bell, AlertTriangle, Calendar, TrendingDown, Package, CheckCheck, Eye, ClipboardList } from 'lucide-react';
import { fmtDate } from '@/lib/dateUtils';
import toast from 'react-hot-toast';
import Link from 'next/link';

const ALERT_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  low_stock: { icon: <TrendingDown size={16} />, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100', label: 'สต็อกต่ำ' },
  near_expiry: { icon: <Calendar size={16} />, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100', label: 'ใกล้หมดอายุ' },
  expired: { icon: <AlertTriangle size={16} />, color: 'text-red-600', bg: 'bg-red-50 border-red-100', label: 'หมดอายุ' },
  overstock: { icon: <Package size={16} />, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', label: 'เกินสต็อก' },

};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterRead, setFilterRead] = useState<'' | 'unread' | 'read'>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await alertApi.getAll();
      setAlerts(res.data);
    } catch (err: any) {
      toast.error(err.message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleMarkRead = async (a: Alert) => {
    try { await alertApi.markRead(a.med_sid, a.alert_type); } catch { }
    setAlerts(prev => prev.map(x => x.id === a.id ? { ...x, is_read: true } : x));
  };

  const handleMarkAllRead = async () => {
    try { await alertApi.markAllRead(); } catch { }
    setAlerts(prev => prev.map(x => ({ ...x, is_read: true })));
    toast.success('อ่านทั้งหมดแล้ว');
  };

  const filtered = alerts.filter(a =>
    (!filterType || a.alert_type === filterType) &&
    (filterRead === '' ||
      (filterRead === 'unread' ? !a.is_read : a.is_read))
  );

  const unread = alerts.filter(a => !a.is_read).length;

  const typeCounts = Object.keys(ALERT_CONFIG).reduce<Record<string, number>>((acc, k) => {
    acc[k] = alerts.filter(a => a.alert_type === k).length;
    return acc;
  }, {});

  return (
    <MainLayout title="การแจ้งเตือน" subtitle={`ยังไม่อ่าน ${unread} รายการ`}
      actions={unread > 0
        ? <Button variant="secondary" size="sm" icon={<CheckCheck size={14} />} onClick={handleMarkAllRead}>อ่านทั้งหมด</Button>
        : undefined}
    >
      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap items-center">
        {[{ value: '', label: 'ทั้งหมด', count: alerts.length },
        ...Object.entries(ALERT_CONFIG).map(([v, { label }]) => ({ value: v, label, count: typeCounts[v] ?? 0 }))
        ].map(({ value, label, count }) => (
          <button key={value} onClick={() => setFilterType(value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterType === value ? 'bg-primary-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-primary-300'}`}>
            {label} <span className="ml-1 opacity-70">({count})</span>
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          {(['', 'unread', 'read'] as const).map((v) => (
            <button key={v} onClick={() => setFilterRead(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterRead === v ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'}`}>
              {v === '' ? 'ทั้งหมด' : v === 'unread' ? 'ยังไม่อ่าน' : 'อ่านแล้ว'}
            </button>
          ))}
          <Button variant="secondary" size="sm" onClick={load}>รีเฟรช</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Bell size={40} />} title="ไม่มีการแจ้งเตือน" description="ระบบคลังยาของคุณอยู่ในสถานะปกติ" />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((a) => {
            const cfg = ALERT_CONFIG[a.alert_type] || ALERT_CONFIG.low_stock;
            return (
              <div key={a.id} className={`card border transition-all ${cfg.bg} ${!a.is_read ? 'ring-1 ring-current/10' : 'opacity-70'}`}>
                <div className="flex items-start gap-4 p-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-white ${cfg.color}`}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <Badge variant={a.severity === 'critical' ? 'danger' : 'warning'}>
                            {a.severity === 'critical' ? 'วิกฤต' : 'เตือน'}
                          </Badge>
                          <Badge variant="gray">{cfg.label}</Badge>
                          {!a.is_read && <span className="w-2 h-2 rounded-full bg-primary-500 shrink-0" />}
                        </div>
                        <p className="font-semibold text-slate-800 text-sm">{a.drug_name}</p>
                        <p className="text-sm text-slate-700 mt-1">{a.message}</p>
                      </div>
                      <p className="text-xs text-slate-400 shrink-0">
                        {fmtDate(a.created_at, true)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Link href={a.alert_type === 'incomplete_record' ? `/drugs?edit=${a.med_sid}` : `/drugs?search=${a.drug_name}`}>
                        <Button variant="secondary" size="xs" icon={<Eye size={12} />}>
                          {a.alert_type === 'incomplete_record' ? 'เพิ่มข้อมูลยา' : 'ดูรายการยา'}
                        </Button>
                      </Link>
                      {!a.is_read && (
                        <Button variant="ghost" size="xs" onClick={() => handleMarkRead(a)}>อ่านแล้ว</Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </MainLayout>
  );
}
