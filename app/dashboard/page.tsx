'use client';
import { useEffect, useState, useCallback } from 'react';
import MainLayout from '@/components/MainLayout';
import { Badge, Spinner } from '@/components/ui';
import {
  dashboardApi, alertApi, drugApi,
  type DashboardStats, type StockSummary, type Drug, type Alert,
} from '@/lib/api';
import {
  Calendar, TrendingDown, Package,
  ArrowDownToLine, ArrowUpFromLine, Activity, RefreshCw,
  RotateCcw, ClipboardList, ClipboardCheck, Users,
  Trash2, SlidersHorizontal, PackageMinus, CalendarClock, CalendarX, Bell, BarChart3,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { fmtDateLabel, fmtDate } from '@/lib/dateUtils';
import Link from 'next/link';
import toast from 'react-hot-toast';

const ALERT_CFG: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string; chartColor: string }> = {
  low_stock: { icon: <TrendingDown size={13} />, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100', label: 'สต็อกต่ำ', chartColor: '#f59e0b' },
  near_expiry: { icon: <Calendar size={13} />, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100', label: 'ใกล้หมดอายุ', chartColor: '#f97316' },
  expired: { icon: <CalendarX size={13} />, color: 'text-red-600', bg: 'bg-red-50 border-red-100', label: 'หมดอายุ', chartColor: '#ef4444' },
  overstock: { icon: <Package size={13} />, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', label: 'เกินสต็อก', chartColor: '#3b82f6' },
  incomplete_record: { icon: <ClipboardList size={13} />, color: 'text-violet-600', bg: 'bg-violet-50 border-violet-100', label: 'ข้อมูลไม่ครบ', chartColor: '#8b5cf6' },
};

const TX_CFG: Record<string, { label: string; icon: React.ReactNode; iconBg: string; qtyColor: string }> = {
  in: { label: 'รับเข้า', icon: <ArrowDownToLine size={13} />, iconBg: 'bg-blue-50 text-blue-600', qtyColor: 'text-blue-600' },
  out: { label: 'จ่ายออก', icon: <ArrowUpFromLine size={13} />, iconBg: 'bg-green-50 text-green-600', qtyColor: 'text-green-600' },
  return: { label: 'คืนยา', icon: <RotateCcw size={13} />, iconBg: 'bg-slate-100 text-slate-500', qtyColor: 'text-slate-500' },
  adjust: { label: 'ปรับสต็อก', icon: <SlidersHorizontal size={13} />, iconBg: 'bg-purple-50 text-purple-600', qtyColor: 'text-purple-600' },
  expired: { label: 'ตัดหมดอายุ', icon: <Trash2 size={13} />, iconBg: 'bg-red-50 text-red-500', qtyColor: 'text-red-500' },
};

function DashboardStatCard({ icon: Icon, label, value, sub, iconBg, valueClass = 'text-gray-900' }: {
  icon: any; label: string; value: number; sub?: string; iconBg: string; valueClass?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-4 sm:p-5 flex items-center gap-4 min-h-[5.5rem]">
      <div className={`${iconBg} w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center shrink-0 shadow-md`}>
        <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs sm:text-sm text-gray-500 font-medium truncate">{label}</p>
        <p className={`text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight ${valueClass}`}>{value.toLocaleString()}</p>
        {sub && <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function ChartCard({ title, icon: Icon, iconColor, toolbar, children, className = '' }: {
  title: string; icon: any; iconColor: string; toolbar?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col min-h-0 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <Icon className={`w-5 h-5 shrink-0 ${iconColor}`} strokeWidth={2} />
          {title}
        </h2>
        {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

function AreaTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-lg text-xs min-w-[130px]">
      <p className="font-bold text-slate-600 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3 mb-1 last:mb-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="text-slate-500">{p.dataKey}</span>
          </div>
          <span className="font-bold tabular-nums" style={{ color: p.color }}>{Number(p.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chart, setChart] = useState<StockSummary[]>([]);
  const [lowStock, setLowStock] = useState<Drug[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

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
      setAlerts(alertsRes.data.filter((a: any) => a.alert_type in ALERT_CFG));
      setLowStock(lowRes.data.data);
      setLastUpdate(new Date());
    } catch (err: any) {
      toast.error(err.message || 'โหลดข้อมูลล้มเหลว');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived chart data ────────────────────────────────────────────────────────
  const chartData = chart.map((r) => ({
    date: fmtDateLabel(r.date),
    รับเข้า: Number(r.stock_in),
    จ่ายออก: Number(r.stock_out),
    คืนยา: Number(r.stock_return),
  }));

  const period = chart.reduce(
    (a, r) => ({ in: a.in + Number(r.stock_in), out: a.out + Number(r.stock_out), rx: a.rx + Number(r.dispensed_count ?? 0) }),
    { in: 0, out: 0, rx: 0 }
  );

  // Alert distribution — use stats for primary 3 types (covers read+unread), alerts array for others
  const alertCountsFromLog: Record<string, number> = {};
  alerts.forEach(a => { alertCountsFromLog[a.alert_type] = (alertCountsFromLog[a.alert_type] ?? 0) + 1; });

  const alertDonutData = stats ? [
    { name: 'สต็อกต่ำ', value: stats.low_stock_count ?? 0, color: ALERT_CFG.low_stock.chartColor },
    { name: 'ใกล้หมดอายุ', value: stats.near_expiry_count ?? 0, color: ALERT_CFG.near_expiry.chartColor },
    { name: 'หมดอายุ', value: stats.expired_count ?? 0, color: ALERT_CFG.expired.chartColor },
    { name: 'เกินสต็อก', value: alertCountsFromLog['overstock'] ?? 0, color: ALERT_CFG.overstock.chartColor },
    { name: 'ข้อมูลไม่ครบ', value: alertCountsFromLog['incomplete_record'] ?? 0, color: ALERT_CFG.incomplete_record.chartColor },
  ].filter(d => d.value > 0) : [];

  const totalAlerts = alertDonutData.reduce((s, d) => s + d.value, 0);

  // Horizontal bar: current vs minimum per low-stock drug
  const stockBarData = lowStock.slice(0, 8).map(d => ({
    name: (d.med_showname || d.med_name || '').slice(0, 14),
    current: d.current_stock ?? 0,
    minimum: d.min_quantity ?? 0,
  }));

  const displayAlerts = alerts.slice(0, 5);
  const unread = alerts.filter(a => !a.is_read).length;

  return (
    <MainLayout
      title="ภาพรวมคลังยาย่อย"
      subtitle={`อัปเดต ${lastUpdate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' })} น.`}
      actions={
        <button onClick={load} disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 hover:bg-blue-100 transition-colors">
          <RefreshCw className={`w-4 h-4 text-blue-600 shrink-0 ${loading ? 'animate-spin' : ''}`} strokeWidth={2} />
          <span className="text-xs sm:text-sm font-semibold text-blue-800">รีเฟรชข้อมูล</span>
        </button>
      }
    >
      <div className="space-y-6 pb-10 px-2 sm:px-4 lg:px-6 w-full">
        {loading && !stats ? (
          <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>
        ) : stats ? (
          <>
            {/* ── KPI cards ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <DashboardStatCard icon={Package} label="รายการยาทั้งหมด" value={stats.total_drugs} iconBg="bg-teal-500" valueClass="text-teal-800" />
              <DashboardStatCard icon={PackageMinus} label="ยาสต็อกต่ำ" value={stats.low_stock_count} sub="ต้องสั่งเพิ่ม" iconBg="bg-violet-600" valueClass="text-violet-900" />
              <DashboardStatCard icon={CalendarClock} label="ยาใกล้หมดอายุ" value={stats.near_expiry_count} sub="ภายใน 30 วัน" iconBg="bg-orange-500" valueClass="text-orange-800" />
              <DashboardStatCard icon={CalendarX} label="ยาหมดอายุแล้ว" value={stats.expired_count} sub="ต้องดำเนินการ" iconBg="bg-rose-500" valueClass="text-rose-800" />
              <DashboardStatCard icon={ClipboardList} label="จ่ายยาวันนี้" value={stats.today_dispense_count} sub="ใบสั่งยา" iconBg="bg-blue-500" valueClass="text-blue-800" />
              <DashboardStatCard icon={ArrowDownToLine} label="รับยาเข้าวันนี้" value={stats.today_stock_in_count} sub="ครั้ง" iconBg="bg-emerald-500" valueClass="text-emerald-800" />
              <DashboardStatCard icon={ClipboardCheck} label="รอจ่ายยา" value={stats.pending_prescriptions} sub="ใบสั่งยา" iconBg="bg-amber-500" valueClass="text-amber-800" />
              <DashboardStatCard icon={Users} label="Queue รอ" value={stats.queue_waiting} sub={`รับยาสำเร็จวันนี้ ${stats.queue_completed_today ?? 0} ราย`} iconBg="bg-indigo-500" valueClass="text-indigo-900" />
            </div>

            {/* ── Charts section ───────────────────────────────────────────── */}
            <ChartCard
              title="กระแสยา 30 วัน"
              icon={BarChart3}
              iconColor="text-blue-600"
              toolbar={
                <div className="hidden sm:flex gap-3 text-[11px] text-slate-500 font-medium bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                  <span>รับเข้า <span className="font-bold text-blue-600">{period.in.toLocaleString()}</span></span>
                  <span>จ่ายออก <span className="font-bold text-emerald-600">{period.out.toLocaleString()}</span></span>
                  <span>ใบสั่งยา <span className="font-bold text-slate-600">{period.rx.toLocaleString()}</span></span>
                </div>
              }
            >
              {chartData.length === 0 ? (
                <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm rounded-xl bg-gray-50 border border-dashed border-gray-200">ยังไม่มีข้อมูล</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={chartData} margin={{ top: 6, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01} />
                      </linearGradient>
                      <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
                      </linearGradient>
                      <linearGradient id="gradRet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                      interval={Math.floor(chartData.length / 8)} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<AreaTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: '10px' }} />
                    <Area type="monotone" dataKey="รับเข้า" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gradIn)" dot={false} activeDot={{ r: 4 }} />
                    <Area type="monotone" dataKey="จ่ายออก" stroke="#10b981" strokeWidth={2.5} fill="url(#gradOut)" dot={false} activeDot={{ r: 4 }} />
                    <Area type="monotone" dataKey="คืนยา" stroke="#94a3b8" strokeWidth={1.5} fill="url(#gradRet)" dot={false} strokeDasharray="4 2" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Horizontal bar: current vs minimum */}
              <ChartCard
                title="เปรียบเทียบสต็อก — ยาสต็อกต่ำ"
                icon={PackageMinus}
                iconColor="text-violet-600"
                toolbar={<Link href="/drugs?low_stock=1" className="text-[11px] font-bold text-blue-600 hover:text-blue-700">ดูทั้งหมด</Link>}
              >
                {stockBarData.length === 0 ? (
                  <div className="flex items-center justify-center h-[220px] text-sm text-gray-400 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
                    สต็อกปกติทั้งหมด 🎉
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(stockBarData.length * 38 + 24, 160)}>
                    <BarChart layout="vertical" data={stockBarData}
                      margin={{ top: 0, right: 24, left: 0, bottom: 0 }} barCategoryGap="28%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false} tickLine={false} width={96} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)' }}
                        formatter={(v: any, key: string) => [v, key === 'current' ? 'สต็อกปัจจุบัน' : 'สต็อกขั้นต่ำ']}
                      />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }}
                        formatter={(v) => v === 'current' ? 'สต็อกปัจจุบัน' : 'สต็อกขั้นต่ำ'} />
                      <Bar dataKey="minimum" name="minimum" fill="#e2e8f0" radius={[0, 3, 3, 0]} maxBarSize={12} />
                      <Bar dataKey="current" name="current" radius={[0, 3, 3, 0]} maxBarSize={12}>
                        {stockBarData.map((entry, i) => (
                          <Cell key={i} fill={entry.current === 0 ? '#ef4444' : '#f59e0b'} fillOpacity={0.88} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              {/* Donut: alert type distribution */}
              <ChartCard title="สัดส่วนการแจ้งเตือน" icon={Bell} iconColor="text-rose-500">
                {alertDonutData.length === 0 ? (
                  <div className="flex items-center justify-center h-[220px] text-sm text-gray-400 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
                    ไม่มีการแจ้งเตือน 🎉
                  </div>
                ) : (
                  <>
                    <div className="relative h-[160px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={alertDonutData} cx="50%" cy="50%"
                            innerRadius={50} outerRadius={72}
                            dataKey="value" paddingAngle={3} startAngle={90} endAngle={-270}>
                            {alertDonutData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}
                            formatter={(v: any, name: string) => [`${v} รายการ`, name]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-black text-slate-800">{totalAlerts}</span>
                        <span className="text-[11px] text-slate-400 font-medium">รายการ</span>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2.5">
                      {alertDonutData.map(d => (
                        <div key={d.name} className="flex items-center gap-3 text-xs">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                          <span className="text-slate-600 flex-1">{d.name}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all"
                                style={{ width: `${Math.round((d.value / totalAlerts) * 100)}%`, background: d.color }} />
                            </div>
                            <span className="font-bold tabular-nums w-5 text-right" style={{ color: d.color }}>{d.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </ChartCard>

              {/* Near expiry list */}
              <ChartCard
                title="ยาใกล้หมดอายุ"
                icon={CalendarClock}
                iconColor="text-orange-500"
                toolbar={<Link href="/drugs?near_expiry=1" className="text-[11px] font-bold text-blue-600 hover:text-blue-700">ดูทั้งหมด</Link>}
              >
                {!stats.near_expiry_top?.length ? (
                  <div className="flex items-center justify-center h-[220px] text-sm text-gray-400 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
                    ไม่มียาใกล้หมดอายุ 🎉
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stats.near_expiry_top.map((d) => {
                      const days = Number(d.days_left);
                      const variant = days <= 7 ? 'danger' : days <= 14 ? 'warning' : 'gray';
                      return (
                        <div key={d.med_sid} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div className="w-9 h-9 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                            <CalendarClock size={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{d.drug_name}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{fmtDate(d.exp_date)} · {d.med_quantity} หน่วย</p>
                            {d.lot_details && <p className="text-[11px] text-slate-400 mt-0.5 truncate">ล็อต: {d.lot_details}</p>}
                          </div>
                          <Badge variant={variant}>{days <= 0 ? 'หมดแล้ว' : `${days} วัน`}</Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ChartCard>
            </div>

            {/* ── Queue + Alerts ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <ChartCard title="Queue วันนี้" icon={Users} iconColor="text-indigo-500">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="py-3 bg-amber-50 rounded-xl border border-amber-100 shadow-sm">
                    <p className="text-3xl font-black text-amber-600">{stats.queue_waiting}</p>
                    <p className="text-xs text-amber-700 font-semibold mt-1">รอ</p>
                  </div>
                  <div className="py-3 bg-emerald-50 rounded-xl border border-emerald-100 shadow-sm">
                    <p className="text-3xl font-black text-emerald-600">{stats.queue_completed_today}</p>
                    <p className="text-xs text-emerald-700 font-semibold mt-1">รับยาสำเร็จ</p>
                  </div>
                </div>
                {stats.pending_prescriptions > 0 && (
                  <Link href="/dispense"
                    className="mt-4 flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-200 hover:bg-amber-100 transition-colors shadow-sm">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck size={18} className="text-amber-600" />
                      <span className="text-sm font-bold text-amber-800">รอจ่ายยา</span>
                    </div>
                    <span className="text-lg font-black text-amber-600">{stats.pending_prescriptions} ใบ</span>
                  </Link>
                )}
              </ChartCard>

              <ChartCard
                title="การแจ้งเตือน"
                icon={Bell}
                iconColor="text-rose-500"
                className="lg:col-span-2"
                toolbar={
                  <div className="flex items-center gap-2">
                    {unread > 0 && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] rounded-full font-black">{unread} ใหม่</span>
                    )}
                    <Link href="/alerts" className="text-[11px] font-bold text-blue-600 hover:text-blue-700">ดูทั้งหมด</Link>
                  </div>
                }
              >
                {displayAlerts.length === 0 ? (
                  <div className="flex items-center justify-center h-[120px] text-sm text-gray-400 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
                    ไม่มีการแจ้งเตือน 🎉
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {displayAlerts.map((a) => {
                      const cfg = ALERT_CFG[a.alert_type] ?? ALERT_CFG.low_stock;
                      return (
                        <div key={a.id} className={`p-3 rounded-xl border text-sm ${cfg.bg}`}>
                          <div className={`flex items-center gap-2 font-bold mb-1 ${cfg.color}`}>{cfg.icon} {cfg.label}</div>
                          <p className="font-semibold text-slate-800 truncate">{a.drug_name}</p>
                          <p className="text-slate-500 text-xs mt-1 line-clamp-1">{a.message}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ChartCard>
            </div>

            {/* ── Recent transactions ─────────────────────────────────────────── */}
            <ChartCard
              title="ธุรกรรมล่าสุด"
              icon={Activity}
              iconColor="text-slate-600"
              toolbar={<Link href="/drugs" className="text-[11px] font-bold text-blue-600 hover:text-blue-700">ดูคลัง</Link>}
            >
              {!stats.recent_transactions?.length ? (
                <div className="flex items-center justify-center h-[120px] text-sm text-gray-400 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
                  ยังไม่มีธุรกรรม
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {stats.recent_transactions.map((tx) => {
                    const cfg = TX_CFG[tx.tx_type] ?? { label: tx.tx_type, icon: <Activity size={15} />, iconBg: 'bg-slate-100 text-slate-500', qtyColor: 'text-slate-500' };
                    const isOut = ['out', 'expired'].includes(tx.tx_type);
                    return (
                      <div key={tx.tx_id} className="flex items-center gap-4 py-3 hover:bg-slate-50/50 transition-colors px-2 -mx-2 rounded-lg">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${cfg.iconBg}`}>
                          {cfg.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{tx.drug_name}</p>
                          <p className="text-xs font-medium text-slate-500 mt-0.5">{cfg.label} · {fmtDate(tx.created_at, true)}</p>
                        </div>
                        <span className={`text-base font-black shrink-0 tabular-nums ${cfg.qtyColor}`}>
                          {tx.tx_type === 'adjust' ? (tx.quantity >= 0 ? '+' : '') : (isOut ? '−' : '+')}
                          {Math.abs(tx.quantity)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </ChartCard>
          </>
        ) : null}
      </div>
    </MainLayout>
  );
}
