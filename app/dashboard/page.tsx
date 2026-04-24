'use client';
import { useEffect, useState, useCallback } from 'react';
import MainLayout from '@/components/MainLayout';
import { StatCard, Card, Badge, Spinner, EmptyState } from '@/components/ui';
import {
  dashboardApi, alertApi, drugApi,
  type DashboardStats, type StockSummary, type Drug, type Alert,
} from '@/lib/api';
import {
  Pill, AlertTriangle, Calendar, Package,
  ArrowDownToLine, Activity, RefreshCw, Clock,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { fmtDateLabel } from '@/lib/dateUtils';
import Link from 'next/link';
import toast from 'react-hot-toast';

function DrugName(d: Drug) {
  return d.med_showname || d.med_name;
}

function StockBar({ current, min, max }: { current: number; min: number; max: number }) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const color = current < min ? '#dc2626' : current < min * 1.5 ? '#d97706' : '#16a34a';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-mono text-slate-600 w-16 text-right shrink-0">{current}/{max}</span>
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
        dashboardApi.getStockSummary(14),
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const chartData = chart.map((r) => ({
    date: fmtDateLabel(r.date),
    รับเข้า: Number(r.stock_in),
    จ่ายออก: Number(r.stock_out),
    คืนยา: Number(r.stock_return),
  }));

  const unread = alerts.filter((a) => !a.is_read).length;

  return (
    <MainLayout
      title="ภาพรวมคลังยาย่อย"
      subtitle={`อัปเดตล่าสุด: ${lastUpdate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' })} น.`}
      actions={
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary-600 px-2 py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          รีเฟรช
        </button>
      }
    >
      {loading && !stats ? (
        <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>
      ) : (
        <>
          {/* KPI Row 1 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <StatCard label="รายการยาทั้งหมด"    value={stats?.total_drugs ?? 0}         icon={<Pill size={20} />}          color="blue" />
            <StatCard label="ยาสต็อกต่ำ"          value={stats?.low_stock_count ?? 0}     icon={<AlertTriangle size={20} />} color="amber" trend="ต้องสั่งเพิ่ม" />
            <StatCard label="ยาใกล้หมดอายุ"       value={stats?.near_expiry_count ?? 0}   icon={<Calendar size={20} />}      color="amber" trend="ภายใน 30 วัน" />
            <StatCard label="ยาหมดอายุ"           value={stats?.expired_count ?? 0}       icon={<AlertTriangle size={20} />} color="red"   trend="ต้องดำเนินการ" />
          </div>

          {/* KPI Row 2 */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <StatCard label="จ่ายยาวันนี้"         value={stats?.today_dispense_count ?? 0}     icon={<Package size={20} />}        color="green" trend="รายการ" />
            <StatCard label="รับยาเข้าวันนี้"      value={stats?.today_stock_in_count ?? 0}     icon={<ArrowDownToLine size={20} />} color="blue"  trend="ครั้ง" />
            <StatCard label="ธุรกรรมวันนี้ทั้งหมด" value={stats?.total_transactions_today ?? 0} icon={<Activity size={20} />}        color="blue" />
          </div>

          {/* Chart + Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
            <Card className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-700">ความเคลื่อนไหวสต็อก 14 วัน</h2>
                <Badge variant="info">2 สัปดาห์</Badge>
              </div>
              {chartData.length === 0 ? (
                <EmptyState icon={<Activity size={32} />} title="ยังไม่มีข้อมูล" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#006fc6" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="#006fc6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16a34a" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="รับเข้า"  stroke="#006fc6" strokeWidth={2} fill="url(#gIn)" />
                    <Area type="monotone" dataKey="จ่ายออก" stroke="#16a34a" strokeWidth={2} fill="url(#gOut)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Card>

            {/* Alerts panel */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-700">การแจ้งเตือน</h2>
                <Link href="/alerts" className="text-xs text-primary-600 hover:underline">ดูทั้งหมด</Link>
              </div>
              {alerts.length === 0 ? (
                <EmptyState icon={<AlertTriangle size={32} />} title="ไม่มีการแจ้งเตือน" />
              ) : (
                <div className="space-y-2">
                  {alerts.map((a) => (
                    <div
                      key={a.id}
                      className={`p-3 rounded-lg border text-xs ${
                        a.severity === 'critical'
                          ? 'bg-red-50 border-red-100'
                          : 'bg-amber-50 border-amber-100'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle
                          size={13}
                          className={`mt-0.5 shrink-0 ${a.severity === 'critical' ? 'text-red-500' : 'text-amber-500'}`}
                        />
                        <div>
                          <p className="font-medium text-slate-700">{a.drug_name}</p>
                          <p className="text-slate-500 mt-0.5">{a.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Low stock table */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-700">ยาสต็อกต่ำ — ต้องสั่งเพิ่ม</h2>
              <Link href="/drugs?low_stock=1" className="text-xs text-primary-600 hover:underline">ดูทั้งหมด</Link>
            </div>
            {lowStock.length === 0 ? (
              <EmptyState icon={<Package size={32} />} title="ไม่มียาสต็อกต่ำ" description="สต็อกปกติทั้งหมด 🎉" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    {['ชื่อยา', 'หมวดหมู่', 'ที่เก็บ', 'คงเหลือ / สูงสุด', 'สถานะ'].map((h) => (
                      <th key={h} className="pb-2 pr-4 text-xs font-medium text-slate-500 last:pr-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map((d) => (
                    <tr key={d.med_sid} className="table-row-hover border-b border-slate-50 last:border-0">
                      <td className="py-2.5 pr-4">
                        <p className="font-medium text-slate-800">{d.med_showname || d.med_name}</p>
                        <p className="text-xs text-slate-400">{d.med_generic_name}</p>
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-slate-500">{d.category || '-'}</td>
                      <td className="py-2.5 pr-4 font-mono text-xs text-slate-500">{d.location || '-'}</td>
                      <td className="py-2.5 pr-4 w-44">
                        <StockBar
                          current={d.current_stock}
                          min={d.min_quantity ?? 0}
                          max={d.max_quantity ?? d.current_stock + 1}
                        />
                      </td>
                      <td className="py-2.5">
                        <Badge variant={d.current_stock === 0 ? 'danger' : d.current_stock < (d.min_quantity ?? 0) ? 'danger' : 'warning'} dot>
                          {d.current_stock === 0 ? 'หมด' : 'ต่ำ'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </MainLayout>
  );
}
