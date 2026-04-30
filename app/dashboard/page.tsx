'use client';
import { useEffect, useState, useCallback } from 'react';
import MainLayout from '@/components/MainLayout';
import { StatCard, Card, Badge, Spinner, EmptyState } from '@/components/ui';
import {
  dashboardApi, alertApi, drugApi,
  type DashboardStats, type StockSummary, type Drug, type Alert,
} from '@/lib/api';
import {
  Pill, AlertTriangle, Calendar, TrendingDown, Package,
  ArrowDownToLine, ArrowUpFromLine, Activity, RefreshCw,
  RotateCcw, ClipboardList, ClipboardCheck, Users,
  ChevronRight, Trash2, SlidersHorizontal,
} from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { fmtDateLabel, fmtDate } from '@/lib/dateUtils';
import Link from 'next/link';
import toast from 'react-hot-toast';

// ── Alert display config ──────────────────────────────────────────────────────
const ALERT_CFG: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  low_stock:         { icon: <TrendingDown size={13} />,  color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-100',   label: 'สต็อกต่ำ' },
  near_expiry:       { icon: <Calendar size={13} />,      color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100', label: 'ใกล้หมดอายุ' },
  expired:           { icon: <AlertTriangle size={13} />, color: 'text-red-600',    bg: 'bg-red-50 border-red-100',       label: 'หมดอายุ' },
  overstock:         { icon: <Package size={13} />,       color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-100',     label: 'เกินสต็อก' },
  incomplete_record: { icon: <ClipboardList size={13} />, color: 'text-violet-600', bg: 'bg-violet-50 border-violet-100', label: 'ข้อมูลไม่ครบ' },
};

// ── Transaction display config ────────────────────────────────────────────────
const TX_CFG: Record<string, { label: string; icon: React.ReactNode; iconBg: string; qtyColor: string; sign: string }> = {
  in:      { label: 'รับเข้า',     icon: <ArrowDownToLine size={13} />,   iconBg: 'bg-blue-50 text-blue-600',    qtyColor: 'text-blue-600',   sign: '+' },
  out:     { label: 'จ่ายออก',    icon: <ArrowUpFromLine size={13} />,   iconBg: 'bg-green-50 text-green-600',  qtyColor: 'text-green-600',  sign: '−' },
  return:  { label: 'คืนยา',      icon: <RotateCcw size={13} />,         iconBg: 'bg-slate-100 text-slate-500', qtyColor: 'text-slate-500',  sign: '+' },
  adjust:  { label: 'ปรับสต็อก',  icon: <SlidersHorizontal size={13} />, iconBg: 'bg-purple-50 text-purple-600',qtyColor: 'text-purple-600', sign: '±' },
  expired: { label: 'ตัดหมดอายุ', icon: <Trash2 size={13} />,            iconBg: 'bg-red-50 text-red-500',      qtyColor: 'text-red-500',    sign: '−' },
};

// ── Stock bar ─────────────────────────────────────────────────────────────────
function StockBar({ current, min, max }: { current: number; min: number; max?: number | null }) {
  const eff = max || min * 2 || current * 2 || 1;
  const pct = Math.min((current / eff) * 100, 100);
  const color = current === 0 ? '#dc2626' : current < min ? '#ef4444' : current < min * 1.5 ? '#d97706' : '#16a34a';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-mono text-slate-400 w-20 text-right shrink-0">
        {current} / {max ?? '—'}
      </span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [stats,     setStats]     = useState<DashboardStats | null>(null);
  const [chart,     setChart]     = useState<StockSummary[]>([]);
  const [lowStock,  setLowStock]  = useState<Drug[]>([]);
  const [alerts,    setAlerts]    = useState<Alert[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [lastUpdate,setLastUpdate]= useState(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, chartRes, alertsRes, lowRes] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getStockSummary(30),
        alertApi.getAll({ is_read: false }),
        drugApi.getAll({ low_stock: '1', limit: 8 }),
      ]);
      setStats(statsRes.data);
      setChart(chartRes.data);
      setAlerts(alertsRes.data.slice(0, 5));
      setLowStock(lowRes.data.data);
      setLastUpdate(new Date());
    } catch (err: any) {
      toast.error(err.message || 'โหลดข้อมูลล้มเหลว');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const chartData = chart.map((r) => ({
    date:     fmtDateLabel(r.date),
    รับเข้า:  Number(r.stock_in),
    จ่ายออก: Number(r.stock_out),
    คืนยา:   Number(r.stock_return),
    ใบสั่งยา: Number(r.dispensed_count ?? 0),
  }));

  const period = chart.reduce(
    (a, r) => ({ in: a.in + Number(r.stock_in), out: a.out + Number(r.stock_out), rx: a.rx + Number(r.dispensed_count ?? 0) }),
    { in: 0, out: 0, rx: 0 }
  );

  const unread = alerts.filter(a => !a.is_read).length;

  return (
    <MainLayout
      title="ภาพรวมคลังยาย่อย"
      subtitle={`อัปเดต ${lastUpdate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' })} น.`}
      actions={
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary-600 px-2 py-1.5 rounded-lg hover:bg-primary-50 transition-colors">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          รีเฟรช
        </button>
      }
    >
      {loading && !stats ? (
        <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>
      ) : stats ? (
        <>
          {/* ── KPI Row 1: สุขภาพคลัง ────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <StatCard label="รายการยาทั้งหมด" value={stats.total_drugs}       icon={<Pill size={20} />}          color="blue" />
            <StatCard label="ยาสต็อกต่ำ"       value={stats.low_stock_count}   icon={<TrendingDown size={20} />}  color="amber" trend="ต้องสั่งเพิ่ม" />
            <StatCard label="ยาใกล้หมดอายุ"    value={stats.near_expiry_count} icon={<Calendar size={20} />}      color="amber" trend="ภายใน 30 วัน" />
            <StatCard label="ยาหมดอายุ"        value={stats.expired_count}     icon={<AlertTriangle size={20} />} color="red"   trend="ต้องดำเนินการ" />
          </div>

          {/* ── KPI Row 2: กิจกรรมวันนี้ ─────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="จ่ายยาวันนี้"    value={stats.today_dispense_count}  icon={<Package size={20} />}        color="green" trend="ใบสั่งยา" />
            <StatCard label="รับยาเข้าวันนี้" value={stats.today_stock_in_count}  icon={<ArrowDownToLine size={20} />} color="blue"  trend="ครั้ง" />
            <StatCard label="รอจ่ายยา"       value={stats.pending_prescriptions} icon={<ClipboardCheck size={20} />}  color="amber" trend="ใบสั่งยา" />
            <StatCard label="Queue รอ"       value={stats.queue_waiting}         icon={<Users size={20} />}           color="blue"
              trend={`เรียกแล้ว ${stats.queue_called ?? 0} · เสร็จ ${stats.queue_completed_today ?? 0}`} />
          </div>

          {/* ── Chart + Right panel ────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

            {/* Chart */}
            <Card className="lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h2 className="text-sm font-semibold text-slate-700">ความเคลื่อนไหวสต็อก 30 วัน</h2>
                <div className="flex gap-3 text-xs text-slate-500">
                  <span>รับเข้า <span className="font-semibold text-blue-600">{period.in.toLocaleString()}</span></span>
                  <span>จ่ายออก <span className="font-semibold text-green-600">{period.out.toLocaleString()}</span></span>
                  <span>ใบสั่งยา <span className="font-semibold text-orange-500">{period.rx.toLocaleString()}</span></span>
                </div>
              </div>
              {chartData.length === 0 ? (
                <EmptyState icon={<Activity size={32} />} title="ยังไม่มีข้อมูล" />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={chartData} margin={{ top: 4, right: 36, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                      interval={Math.floor(chartData.length / 8)} />
                    <YAxis yAxisId="left"  tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#f97316' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="left" dataKey="รับเข้า"  fill="#3b82f6" opacity={0.85} radius={[2,2,0,0]} maxBarSize={10} />
                    <Bar yAxisId="left" dataKey="จ่ายออก" fill="#22c55e" opacity={0.85} radius={[2,2,0,0]} maxBarSize={10} />
                    <Bar yAxisId="left" dataKey="คืนยา"   fill="#cbd5e1" opacity={0.8}  radius={[2,2,0,0]} maxBarSize={6}  />
                    <Line yAxisId="right" dataKey="ใบสั่งยา" stroke="#f97316" strokeWidth={2} dot={false} strokeDasharray="4 3" />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </Card>

            {/* Right: Queue + Alerts */}
            <div className="flex flex-col gap-4">
              {/* Queue summary */}
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-slate-700">Queue วันนี้</h2>
                  <Link href="/queue" className="text-xs text-primary-600 hover:underline flex items-center gap-0.5">
                    จัดการ <ChevronRight size={11} />
                  </Link>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="py-2.5 bg-amber-50 rounded-xl">
                    <p className="text-2xl font-bold text-amber-600">{stats.queue_waiting}</p>
                    <p className="text-xs text-amber-600 mt-0.5">รอ</p>
                  </div>
                  <div className="py-2.5 bg-blue-50 rounded-xl">
                    <p className="text-2xl font-bold text-blue-600">{stats.queue_called ?? 0}</p>
                    <p className="text-xs text-blue-600 mt-0.5">กำลังเรียก</p>
                  </div>
                  <div className="py-2.5 bg-green-50 rounded-xl">
                    <p className="text-2xl font-bold text-green-600">{stats.queue_completed_today}</p>
                    <p className="text-xs text-green-600 mt-0.5">เสร็จแล้ว</p>
                  </div>
                </div>
                {stats.pending_prescriptions > 0 && (
                  <Link href="/dispense"
                    className="mt-3 flex items-center justify-between p-2.5 bg-amber-50 rounded-xl border border-amber-100 hover:bg-amber-100 transition-colors">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck size={14} className="text-amber-600" />
                      <span className="text-xs font-medium text-amber-700">รอจ่ายยา</span>
                    </div>
                    <span className="text-sm font-bold text-amber-600">{stats.pending_prescriptions} ใบ</span>
                  </Link>
                )}
              </Card>

              {/* Alerts */}
              <Card className="flex-1 min-h-0">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-slate-700">
                    แจ้งเตือน
                    {unread > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded-full font-bold">{unread}</span>
                    )}
                  </h2>
                  <Link href="/alerts" className="text-xs text-primary-600 hover:underline flex items-center gap-0.5">
                    ดูทั้งหมด <ChevronRight size={11} />
                  </Link>
                </div>
                {alerts.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">ไม่มีการแจ้งเตือน 🎉</p>
                ) : (
                  <div className="space-y-1.5">
                    {alerts.map((a) => {
                      const cfg = ALERT_CFG[a.alert_type] ?? ALERT_CFG.low_stock;
                      return (
                        <div key={a.id} className={`p-2.5 rounded-lg border text-xs ${cfg.bg}`}>
                          <div className={`flex items-center gap-1.5 font-medium mb-0.5 ${cfg.color}`}>
                            {cfg.icon} {cfg.label}
                          </div>
                          <p className="font-medium text-slate-700 truncate">{a.drug_name}</p>
                          <p className="text-slate-500 mt-0.5 line-clamp-1">{a.message}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          </div>

          {/* ── Low stock + Near expiry ────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            {/* Low stock */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-700">ยาสต็อกต่ำ — ต้องสั่งเพิ่ม</h2>
                <Link href="/drugs?low_stock=1" className="text-xs text-primary-600 hover:underline">ดูทั้งหมด</Link>
              </div>
              {lowStock.length === 0 ? (
                <EmptyState icon={<Package size={28} />} title="สต็อกปกติทั้งหมด 🎉" />
              ) : (
                <div className="space-y-3">
                  {lowStock.map((d) => (
                    <div key={d.med_sid}>
                      <div className="flex items-start justify-between mb-1 gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{d.med_showname || d.med_name}</p>
                          <p className="text-xs text-slate-400 truncate">{d.category || d.location || '—'}</p>
                        </div>
                        <Badge variant={d.current_stock === 0 ? 'danger' : 'warning'} dot>
                          {d.current_stock === 0 ? 'หมด' : 'ต่ำ'}
                        </Badge>
                      </div>
                      <StockBar current={d.current_stock} min={d.min_quantity ?? 0} max={d.max_quantity} />
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Near expiry */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-700">ยาใกล้หมดอายุ</h2>
                <Link href="/drugs?near_expiry=1" className="text-xs text-primary-600 hover:underline">ดูทั้งหมด</Link>
              </div>
              {!stats.near_expiry_top?.length ? (
                <EmptyState icon={<Calendar size={28} />} title="ไม่มียาใกล้หมดอายุ 🎉" />
              ) : (
                <div className="space-y-2.5">
                  {stats.near_expiry_top.map((d) => {
                    const days = Number(d.days_left);
                    const variant = days <= 7 ? 'danger' : days <= 14 ? 'warning' : 'gray';
                    return (
                      <div key={d.med_sid} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{d.drug_name}</p>
                          <p className="text-xs text-slate-400">{fmtDate(d.exp_date)} · เหลือ {d.med_quantity} หน่วย</p>
                        </div>
                        <Badge variant={variant}>
                          {days <= 0 ? 'หมดแล้ว' : `${days} วัน`}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* ── Recent transactions ─────────────────────────────────────────── */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-700">ธุรกรรมล่าสุด</h2>
              <Link href="/drugs" className="text-xs text-primary-600 hover:underline">ดูคลัง</Link>
            </div>
            {!stats.recent_transactions?.length ? (
              <EmptyState icon={<Activity size={28} />} title="ยังไม่มีธุรกรรม" />
            ) : (
              <div className="divide-y divide-slate-50">
                {stats.recent_transactions.map((tx) => {
                  const cfg = TX_CFG[tx.tx_type] ?? { label: tx.tx_type, icon: <Activity size={13} />, iconBg: 'bg-slate-100 text-slate-500', qtyColor: 'text-slate-500', sign: '' };
                  const isOut = ['out', 'expired'].includes(tx.tx_type);
                  return (
                    <div key={tx.tx_id} className="flex items-center gap-3 py-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
                        {cfg.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{tx.drug_name}</p>
                        <p className="text-xs text-slate-400">{cfg.label} · {fmtDate(tx.created_at, true)}</p>
                      </div>
                      <span className={`text-sm font-semibold shrink-0 tabular-nums ${cfg.qtyColor}`}>
                        {tx.tx_type === 'adjust' ? (tx.quantity >= 0 ? '+' : '') : (isOut ? '−' : '+')}
                        {Math.abs(tx.quantity)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      ) : null}
    </MainLayout>
  );
}
