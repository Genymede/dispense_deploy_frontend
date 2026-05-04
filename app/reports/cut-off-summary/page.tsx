'use client';
import { useEffect, useState, useCallback } from 'react';
import MainLayout from '@/components/MainLayout';
import { Card, Button, Badge, Spinner, EmptyState } from '@/components/ui';
import { api, extraReportApi } from '@/lib/api';
import { fmtDate } from '@/lib/dateUtils';
import toast from 'react-hot-toast';
import {
  CalendarClock, Play, CheckCircle2, XCircle,
  AlertTriangle, PackageX, Package, Clock,
  BarChart3, RefreshCw, Warehouse,
} from 'lucide-react';

interface CutOffPeriod {
  med_period_id: number;
  sub_warehouse_id: number;
  warehouse_name: string;
  period_month: number;
  period_day: number;
  period_time_h: number;
  period_time_m: number;
  is_active: boolean;
  last_executed_at: string | null;
}

interface CutOffSummaryResult {
  warehouse_name: string;
  newly_expired_count: number;
  near_expiry_count: number;
  low_stock_count: number;
  snapshot_count: number;
}

interface RunLog {
  period_id: number;
  warehouse_name: string;
  executed_at: string;
  summary: CutOffSummaryResult;
  status: 'success' | 'error';
  error?: string;
}

const MONTH_TH = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function fmtSchedule(row: CutOffPeriod) {
  const d = row.period_day;
  const m = MONTH_TH[row.period_month] || `เดือน ${row.period_month}`;
  const h = String(row.period_time_h ?? 0).padStart(2, '0');
  const min = String(row.period_time_m ?? 0).padStart(2, '0');
  return `${d} ${m} เวลา ${h}:${min} น.`;
}

function timeSince(iso: string | null): string {
  if (!iso) return 'ยังไม่เคยรัน';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hrs / 24);
  return `${days} วันที่แล้ว`;
}

export default function CutOffSummaryPage() {
  const [periods, setPeriods] = useState<CutOffPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState<number | null>(null);
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await extraReportApi.getCutOff();
      const data: CutOffPeriod[] = res.data?.data ?? res.data ?? [];
      setPeriods(data);
      if (data.length > 0 && selectedWarehouse === null) {
        setSelectedWarehouse(data[0].med_period_id);
      }
    } catch (err: any) {
      toast.error(err?.message || 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleExecute = async (row: CutOffPeriod) => {
    const id = row.med_period_id;
    setExecuting(id);
    try {
      const res = await api.post(`/reports/cut-off/${id}/execute`);
      const s: CutOffSummaryResult = res.data?.summary;
      if (s) {
        const log: RunLog = {
          period_id: id,
          warehouse_name: row.warehouse_name,
          executed_at: new Date().toISOString(),
          summary: s,
          status: 'success',
        };
        setLogs(prev => [log, ...prev].slice(0, 20));
        toast.success(
          `ตัดรอบ "${s.warehouse_name}" สำเร็จ — หมดอายุ ${s.newly_expired_count} | ใกล้หมดอายุ ${s.near_expiry_count} | สต็อกต่ำ ${s.low_stock_count}`,
          { duration: 6000 }
        );
      } else {
        toast.success('ดำเนินการตัดรอบเรียบร้อย');
      }
      await load();
    } catch (err: any) {
      const log: RunLog = {
        period_id: id,
        warehouse_name: row.warehouse_name,
        executed_at: new Date().toISOString(),
        summary: { warehouse_name: row.warehouse_name, newly_expired_count: 0, near_expiry_count: 0, low_stock_count: 0, snapshot_count: 0 },
        status: 'error',
        error: err?.message,
      };
      setLogs(prev => [log, ...prev].slice(0, 20));
      toast.error(err?.message || 'เกิดข้อผิดพลาดในการตัดรอบ');
    } finally {
      setExecuting(null);
    }
  };

  const active = periods.filter(p => p.is_active);
  const inactive = periods.filter(p => !p.is_active);
  const recentlyRan = periods.filter(p => {
    if (!p.last_executed_at) return false;
    const diff = Date.now() - new Date(p.last_executed_at).getTime();
    return diff < 24 * 60 * 60 * 1000;
  });

  const selectedPeriod = periods.find(p => p.med_period_id === selectedWarehouse) ?? null;

  return (
    <MainLayout
      title="สรุปการตัดรอบ"
      subtitle="ภาพรวมสถานะ Cut-off Period ทุกคลังยา"
      actions={
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw size={14} />}
          onClick={load}
          loading={loading}
        >
          รีเฟรช
        </Button>
      }
    >
      {loading ? (
        <div className="flex justify-center py-24"><Spinner size={32} /></div>
      ) : (
        <div className="space-y-6">

          {/* ── KPI Cards ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: 'คลังยาทั้งหมด',
                value: periods.length,
                icon: <Warehouse size={20} />,
                color: 'text-blue-700',
                bg: 'bg-blue-50',
                border: 'border-blue-100',
              },
              {
                label: 'ใช้งานอยู่',
                value: active.length,
                icon: <CheckCircle2 size={20} />,
                color: 'text-green-700',
                bg: 'bg-green-50',
                border: 'border-green-100',
              },
              {
                label: 'รันแล้วใน 24 ชม.',
                value: recentlyRan.length,
                icon: <Clock size={20} />,
                color: 'text-amber-700',
                bg: 'bg-amber-50',
                border: 'border-amber-100',
              },
              {
                label: 'รันใน session นี้',
                value: logs.filter(l => l.status === 'success').length,
                icon: <BarChart3 size={20} />,
                color: 'text-purple-700',
                bg: 'bg-purple-50',
                border: 'border-purple-100',
              },
            ].map(({ label, value, icon, color, bg, border }) => (
              <Card key={label} className={`border ${border} ${bg}`}>
                <div className="flex items-center gap-3">
                  <div className={`${color} opacity-80`}>{icon}</div>
                  <div>
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* ── Main Grid ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-5">

            {/* ── Warehouse List (left) ──────────────────────────── */}
            <div className="col-span-1 space-y-3">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Warehouse size={15} className="text-slate-400" />
                รายการคลัง ({periods.length})
              </h3>

              {periods.length === 0 ? (
                <EmptyState icon={<CalendarClock size={32} />} title="ไม่พบรายการ" />
              ) : (
                <div className="space-y-2">
                  {periods.map(row => {
                    const isSelected = selectedWarehouse === row.med_period_id;
                    const isLoading = executing === row.med_period_id;
                    return (
                      <div
                        key={row.med_period_id}
                        onClick={() => setSelectedWarehouse(row.med_period_id)}
                        className={`
                          rounded-xl border p-3.5 cursor-pointer transition-all
                          ${isSelected
                            ? 'border-blue-400 bg-blue-50 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                          }
                        `}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className={`text-sm font-semibold truncate ${isSelected ? 'text-blue-800' : 'text-slate-800'}`}>
                              {row.warehouse_name}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">{fmtSchedule(row)}</p>
                          </div>
                          <Badge variant={row.is_active ? 'success' : 'gray'} className="shrink-0 mt-0.5">
                            {row.is_active ? 'ใช้งาน' : 'ปิด'}
                          </Badge>
                        </div>
                        <div className="mt-2.5 flex items-center justify-between">
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Clock size={10} />
                            {timeSince(row.last_executed_at)}
                          </span>
                          <Button
                            size="sm"
                            variant={isSelected ? 'primary' : 'secondary'}
                            icon={<Play size={11} />}
                            loading={isLoading}
                            onClick={e => { e.stopPropagation(); handleExecute(row); }}
                          >
                            ตัดรอบ
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Detail + Log (right) ───────────────────────────── */}
            <div className="col-span-2 space-y-5">

              {/* Selected period detail */}
              {selectedPeriod && (
                <Card>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-800">{selectedPeriod.warehouse_name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">รายละเอียดกำหนดการตัดรอบ</p>
                    </div>
                    <Badge variant={selectedPeriod.is_active ? 'success' : 'gray'} dot>
                      {selectedPeriod.is_active ? 'ใช้งาน' : 'ปิดการใช้งาน'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'วันที่กำหนด', value: `${selectedPeriod.period_day} ${MONTH_TH[selectedPeriod.period_month]}` },
                      { label: 'เวลาที่กำหนด', value: `${String(selectedPeriod.period_time_h ?? 0).padStart(2, '0')}:${String(selectedPeriod.period_time_m ?? 0).padStart(2, '0')} น.` },
                      { label: 'รันล่าสุด', value: selectedPeriod.last_executed_at ? fmtDate(selectedPeriod.last_executed_at, true) : '—' },
                      { label: 'นานแค่ไหน', value: timeSince(selectedPeriod.last_executed_at) },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-slate-50 rounded-lg p-3">
                        <p className="text-[11px] text-slate-500">{label}</p>
                        <p className="text-sm font-semibold text-slate-800 mt-1">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="primary"
                      icon={<Play size={14} />}
                      loading={executing === selectedPeriod.med_period_id}
                      onClick={() => handleExecute(selectedPeriod)}
                    >
                      ดำเนินการตัดรอบทันที
                    </Button>
                  </div>
                </Card>
              )}

              {/* Run log (session) */}
              <Card className="overflow-hidden p-0">
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <CalendarClock size={15} className="text-slate-400" />
                    ประวัติการรัน (session นี้)
                  </h3>
                  <span className="text-xs text-slate-400">{logs.length} รายการ</span>
                </div>

                {logs.length === 0 ? (
                  <div className="py-12">
                    <EmptyState
                      icon={<BarChart3 size={32} />}
                      title="ยังไม่มีประวัติ"
                      description="กดปุ่ม 'ตัดรอบ' เพื่อเริ่มต้น"
                    />
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {logs.map((log, i) => (
                      <div key={i} className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50/50 transition-colors">
                        {log.status === 'success' ? (
                          <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                        ) : (
                          <XCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-800">{log.warehouse_name}</span>
                            <Badge variant={log.status === 'success' ? 'success' : 'danger'}>
                              {log.status === 'success' ? 'สำเร็จ' : 'ล้มเหลว'}
                            </Badge>
                            <span className="text-xs text-slate-400 ml-auto">{fmtDate(log.executed_at, true)}</span>
                          </div>
                          {log.status === 'success' && (
                            <div className="mt-1.5 flex flex-wrap gap-3">
                              <span className="flex items-center gap-1 text-[11px] text-red-600">
                                <PackageX size={11} />
                                หมดอายุ <strong>{log.summary.newly_expired_count}</strong>
                              </span>
                              <span className="flex items-center gap-1 text-[11px] text-amber-600">
                                <AlertTriangle size={11} />
                                ใกล้หมดอายุ <strong>{log.summary.near_expiry_count}</strong>
                              </span>
                              <span className="flex items-center gap-1 text-[11px] text-blue-600">
                                <Package size={11} />
                                สต็อกต่ำ <strong>{log.summary.low_stock_count}</strong>
                              </span>
                              <span className="flex items-center gap-1 text-[11px] text-slate-500">
                                Snapshot <strong>{log.summary.snapshot_count}</strong> รายการ
                              </span>
                            </div>
                          )}
                          {log.status === 'error' && (
                            <p className="mt-1 text-xs text-red-500">{log.error}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* All warehouses status table */}
              <Card className="overflow-hidden p-0">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-700">สถานะคลังยาทั้งหมด</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        {['คลังยา', 'กำหนดการ', 'สถานะ', 'รันล่าสุด', 'เมื่อนานแค่ไหน', 'การดำเนินการ'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {periods.map(row => (
                        <tr key={row.med_period_id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-800">{row.warehouse_name}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{fmtSchedule(row)}</td>
                          <td className="px-4 py-3">
                            <Badge variant={row.is_active ? 'success' : 'gray'} dot>
                              {row.is_active ? 'ใช้งาน' : 'ปิด'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                            {row.last_executed_at ? fmtDate(row.last_executed_at, true) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">{timeSince(row.last_executed_at)}</td>
                          <td className="px-4 py-3">
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={<Play size={11} />}
                              loading={executing === row.med_period_id}
                              onClick={() => handleExecute(row)}
                            >
                              ตัดรอบ
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
