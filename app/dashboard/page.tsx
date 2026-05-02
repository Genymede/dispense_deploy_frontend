'use client';
import { useEffect, useState, useCallback } from 'react';
import MainLayout from '@/components/MainLayout';
import { Badge, Spinner, EmptyState } from '@/components/ui';
import {
  dashboardApi, alertApi, drugApi,
  type DashboardStats, type StockSummary, type Drug, type Alert,
} from '@/lib/api';
import {
  Calendar, TrendingDown, Package,
  ArrowDownToLine, ArrowUpFromLine, Activity, RefreshCw,
  RotateCcw, ClipboardList, ClipboardCheck, Users,
  Trash2, SlidersHorizontal, PackageMinus, CalendarClock, CalendarX, Bell, BarChart3
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
  low_stock: { icon: <TrendingDown size={13} />, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100', label: 'สต็อกต่ำ' },
  near_expiry: { icon: <Calendar size={13} />, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100', label: 'ใกล้หมดอายุ' },
  expired: { icon: <CalendarX size={13} />, color: 'text-red-600', bg: 'bg-red-50 border-red-100', label: 'หมดอายุ' },
  overstock: { icon: <Package size={13} />, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', label: 'เกินสต็อก' },
  incomplete_record: { icon: <ClipboardList size={13} />, color: 'text-violet-600', bg: 'bg-violet-50 border-violet-100', label: 'ข้อมูลไม่ครบ' },
};

// ── Transaction display config ────────────────────────────────────────────────
const TX_CFG: Record<string, { label: string; icon: React.ReactNode; iconBg: string; qtyColor: string; sign: string }> = {
  in: { label: 'รับเข้า', icon: <ArrowDownToLine size={13} />, iconBg: 'bg-blue-50 text-blue-600', qtyColor: 'text-blue-600', sign: '+' },
  out: { label: 'จ่ายออก', icon: <ArrowUpFromLine size={13} />, iconBg: 'bg-green-50 text-green-600', qtyColor: 'text-green-600', sign: '−' },
  return: { label: 'คืนยา', icon: <RotateCcw size={13} />, iconBg: 'bg-slate-100 text-slate-500', qtyColor: 'text-slate-500', sign: '+' },
  adjust: { label: 'ปรับสต็อก', icon: <SlidersHorizontal size={13} />, iconBg: 'bg-purple-50 text-purple-600', qtyColor: 'text-purple-600', sign: '±' },
  expired: { label: 'ตัดหมดอายุ', icon: <Trash2 size={13} />, iconBg: 'bg-red-50 text-red-500', qtyColor: 'text-red-500', sign: '−' },
};

// ── Custom Components from page-test.tsx ──────────────────────────────────────
function DashboardStatCard({
  icon: Icon,
  label,
  value,
  sub,
  iconBg,
  valueClass = "text-gray-900",
}: {
  icon: any;
  label: string;
  value: number;
  sub?: string;
  iconBg: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-4 sm:p-5 flex items-center gap-4 min-h-[5.5rem]">
      <div className={`${iconBg} w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center shrink-0 shadow-md`}>
        <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs sm:text-sm text-gray-500 font-medium truncate">{label}</p>
        <p className={`text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight ${valueClass}`}>
          {value.toLocaleString()}
        </p>
        {sub ? <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5 truncate">{sub}</p> : null}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  icon: Icon,
  iconColor,
  toolbar,
  children,
  className = "",
}: {
  title: string;
  icon: any;
  iconColor: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col min-h-0 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <Icon className={`w-5 h-5 shrink-0 ${iconColor}`} strokeWidth={2} />
          {title}
        </h2>
        {toolbar ? <div className="flex flex-wrap items-center gap-2">{toolbar}</div> : null}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

// ── Toggle Group ──────────────────────────────────────────────────────────────
function ToggleGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="flex bg-slate-100 rounded-lg p-0.5">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold rounded-md transition-all ${value === opt.id ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Stock bar ─────────────────────────────────────────────────────────────────
function StockBar({ current, min, max }: { current: number; min: number; max?: number | null }) {
  const eff = max || min * 2 || current * 2 || 1;
  const pct = Math.min((current / eff) * 100, 100);
  const color = current === 0 ? '#ef4444' : current < min ? '#f43f5e' : current < min * 1.5 ? '#f59e0b' : '#10b981';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-mono text-slate-400 w-20 text-right shrink-0">
        {current} / {max ?? '—'}
      </span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chart, setChart] = useState<StockSummary[]>([]);
  const [lowStock, setLowStock] = useState<Drug[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [chartType, setChartType] = useState<"bar" | "line">("bar");

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
    date: fmtDateLabel(r.date),
    รับเข้า: Number(r.stock_in),
    จ่ายออก: Number(r.stock_out),
    คืนยา: Number(r.stock_return),
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
            {/* ── KPI ──────────────────────────────────────────────────────── */}
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

            {/* ── Chart + Right panel ────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Chart */}
              <ChartCard
                title="ความเคลื่อนไหวสต็อก 30 วัน"
                icon={BarChart3}
                iconColor="text-blue-600"
                className="lg:col-span-2"
                toolbar={
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <ToggleGroup
                      value={chartType}
                      onChange={setChartType}
                      options={[
                        { id: "bar", label: "แท่ง" },
                        { id: "line", label: "เส้น" },
                      ]}
                    />
                    <div className="hidden sm:flex gap-3 text-[11px] sm:text-xs text-slate-500 font-medium bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                      <span>รับเข้า <span className="font-bold text-blue-600">{period.in.toLocaleString()}</span></span>
                      <span>จ่ายออก <span className="font-bold text-green-600">{period.out.toLocaleString()}</span></span>
                      <span>ใบสั่งยา <span className="font-bold text-orange-500">{period.rx.toLocaleString()}</span></span>
                    </div>
                  </div>
                }
              >
                {chartData.length === 0 ? (
                  <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm rounded-xl bg-gray-50 border border-dashed border-gray-200">
                    ยังไม่มีข้อมูล
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={chartData} margin={{ top: 4, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                        interval={Math.floor(chartData.length / 8)} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#f97316' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: '10px' }} />

                      {chartType === "bar" ? (
                        <>
                          <Bar yAxisId="left" dataKey="รับเข้า" fill="#3b82f6" opacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={12} />
                          <Bar yAxisId="left" dataKey="จ่ายออก" fill="#10b981" opacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={12} />
                          <Bar yAxisId="left" dataKey="คืนยา" fill="#cbd5e1" opacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={8} />
                          <Line type="monotone" yAxisId="right" dataKey="ใบสั่งยา" stroke="#f97316" strokeWidth={2.5} dot={false} strokeDasharray="4 3" />
                        </>
                      ) : (
                        <>
                          <Line type="monotone" yAxisId="left" dataKey="รับเข้า" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} />
                          <Line type="monotone" yAxisId="left" dataKey="จ่ายออก" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                          <Line type="monotone" yAxisId="left" dataKey="คืนยา" stroke="#cbd5e1" strokeWidth={2.5} dot={{ r: 3 }} />
                          <Line type="monotone" yAxisId="right" dataKey="ใบสั่งยา" stroke="#f97316" strokeWidth={2.5} dot={{ r: 3 }} strokeDasharray="4 3" />
                        </>
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              {/* Right: Queue + Alerts */}
              <div className="flex flex-col gap-6">
                {/* Queue summary */}
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

                {/* Alerts */}
                <ChartCard
                  title="การแจ้งเตือน"
                  icon={Bell}
                  iconColor="text-rose-500"
                  className="flex-1 min-h-0"
                  toolbar={
                    <div className="flex items-center gap-2">
                      {unread > 0 && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] rounded-full font-black tracking-wide uppercase">
                          {unread} ใหม่
                        </span>
                      )}
                      <Link href="/alerts" className="text-[11px] font-bold text-blue-600 hover:text-blue-700 transition-colors">
                        ดูทั้งหมด
                      </Link>
                    </div>
                  }
                >
                  {alerts.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-sm text-gray-400 bg-gray-50 border border-dashed border-gray-200 rounded-xl min-h-[120px]">
                      ไม่มีการแจ้งเตือน 🎉
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {alerts.map((a) => {
                        const cfg = ALERT_CFG[a.alert_type] ?? ALERT_CFG.low_stock;
                        return (
                          <div key={a.id} className={`p-3 rounded-xl border text-sm ${cfg.bg}`}>
                            <div className={`flex items-center gap-2 font-bold mb-1 ${cfg.color}`}>
                              {cfg.icon} {cfg.label}
                            </div>
                            <p className="font-semibold text-slate-800 truncate">{a.drug_name}</p>
                            <p className="text-slate-500 text-xs mt-1 line-clamp-1">{a.message}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ChartCard>
              </div>
            </div>

            {/* ── Low stock + Near expiry ────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Low stock */}
              <ChartCard
                title="ยาสต็อกต่ำ — ต้องสั่งเพิ่ม"
                icon={PackageMinus}
                iconColor="text-violet-600"
                toolbar={<Link href="/drugs?low_stock=1" className="text-[11px] font-bold text-blue-600 hover:text-blue-700">ดูทั้งหมด</Link>}
              >
                {lowStock.length === 0 ? (
                  <div className="flex items-center justify-center h-[200px] text-sm text-gray-400 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
                    สต็อกปกติทั้งหมด 🎉
                  </div>
                ) : (
                  <div className="space-y-4">
                    {lowStock.map((d) => (
                      <div key={d.med_sid} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="flex items-start justify-between mb-2 gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{d.med_showname || d.med_name}</p>
                            <p className="text-xs font-medium text-slate-500 truncate">{d.category || d.location || '—'}</p>
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
              </ChartCard>

              {/* Near expiry */}
              <ChartCard
                title="ยาใกล้หมดอายุ"
                icon={CalendarClock}
                iconColor="text-orange-500"
                toolbar={<Link href="/drugs?near_expiry=1" className="text-[11px] font-bold text-blue-600 hover:text-blue-700">ดูทั้งหมด</Link>}
              >
                {!stats.near_expiry_top?.length ? (
                  <div className="flex items-center justify-center h-[200px] text-sm text-gray-400 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
                    ไม่มียาใกล้หมดอายุ 🎉
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stats.near_expiry_top.map((d) => {
                      const days = Number(d.days_left);
                      const variant = days <= 7 ? 'danger' : days <= 14 ? 'warning' : 'gray';
                      return (
                        <div key={d.med_sid} className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 shadow-sm">
                            <CalendarClock size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{d.drug_name}</p>
                            <p className="text-xs font-medium text-slate-500 mt-0.5">{fmtDate(d.exp_date)} · เหลือ {d.med_quantity} หน่วย</p>
                          </div>
                          <Badge variant={variant}>
                            {days <= 0 ? 'หมดแล้ว' : `${days} วัน`}
                          </Badge>
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
                    const cfg = TX_CFG[tx.tx_type] ?? { label: tx.tx_type, icon: <Activity size={15} />, iconBg: 'bg-slate-100 text-slate-500', qtyColor: 'text-slate-500', sign: '' };
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
