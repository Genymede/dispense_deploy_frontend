'use client';
import { useEffect, useState, useCallback } from 'react';
import MainLayout from '@/components/MainLayout';
import { Card, Button, Badge, Spinner, EmptyState, Modal, Input, Select } from '@/components/ui';
import { extraReportApi } from '@/lib/api';
import { fmtDate } from '@/lib/dateUtils';
import toast from 'react-hot-toast';
import {
  CalendarClock, Play, CheckCircle2, XCircle,
  AlertTriangle, PackageX, Package, Clock,
  RefreshCw, Warehouse, Plus, Pencil, Trash2,
} from 'lucide-react';

interface SubWarehouse { sub_warehouse_id: number; name: string; is_active: boolean; }
interface CutOffPeriod {
  med_period_id: number; sub_warehouse_id: number; warehouse_name: string;
  period_month: number; period_day: number; period_time_h: number; period_time_m: number;
  is_active: boolean; last_executed_at: string | null;
}
interface RunLog {
  warehouse_name: string; executed_at: string; status: 'success' | 'error'; error?: string;
  newly_expired_count?: number; near_expiry_count?: number; low_stock_count?: number; snapshot_count?: number;
}

const MONTHS = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const pad = (n: number) => String(n ?? 0).padStart(2, '0');
const fmtSched = (r: CutOffPeriod) => `${r.period_day} ${MONTHS[r.period_month]} ${pad(r.period_time_h)}:${pad(r.period_time_m)} น.`;
const timeSince = (iso: string | null) => {
  if (!iso) return 'ยังไม่เคยรัน';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ชม.ที่แล้ว`;
  return `${Math.floor(h / 24)} วันที่แล้ว`;
};

const emptyForm = { sub_warehouse_id: '', period_month: '1', period_day: '1', period_time_h: '0', period_time_m: '0', is_active: true };

export default function CutOffSummaryPage() {
  const [periods, setPeriods] = useState<CutOffPeriod[]>([]);
  const [warehouses, setWarehouses] = useState<SubWarehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState<number | null>(null);
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [selected, setSelected] = useState<number | null>(null);

  // Form modal state
  const [showModal, setShowModal] = useState(false);
  const [editRow, setEditRow] = useState<CutOffPeriod | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, wRes] = await Promise.all([
        extraReportApi.getCutOff(),
        extraReportApi.getSubWarehouses(),
      ]);
      const data: CutOffPeriod[] = pRes.data?.data ?? pRes.data ?? [];
      setPeriods(data);
      setWarehouses(wRes.data?.data ?? wRes.data ?? []);
      if (data.length > 0 && selected === null) setSelected(data[0].med_period_id);
    } catch (err: any) {
      toast.error(err?.message || 'โหลดข้อมูลไม่สำเร็จ');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditRow(null); setForm({ ...emptyForm }); setShowModal(true); };
  const openEdit = (row: CutOffPeriod, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditRow(row);
    setForm({
      sub_warehouse_id: String(row.sub_warehouse_id),
      period_month: String(row.period_month),
      period_day: String(row.period_day),
      period_time_h: String(row.period_time_h),
      period_time_m: String(row.period_time_m),
      is_active: row.is_active,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.sub_warehouse_id) { toast.error('กรุณาเลือกคลังยา'); return; }
    setSaving(true);
    try {
      const payload = {
        sub_warehouse_id: Number(form.sub_warehouse_id),
        period_month: Number(form.period_month),
        period_day: Number(form.period_day),
        period_time_h: Number(form.period_time_h),
        period_time_m: Number(form.period_time_m),
        is_active: form.is_active,
      };
      if (editRow) {
        await extraReportApi.updateCutOff(editRow.med_period_id, payload);
        toast.success('แก้ไขเรียบร้อย');
      } else {
        await extraReportApi.createCutOff(payload);
        toast.success('เพิ่มกำหนดการตัดรอบเรียบร้อย');
      }
      setShowModal(false);
      await load();
    } catch (err: any) { toast.error(err?.message || 'เกิดข้อผิดพลาด'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (row: CutOffPeriod, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`ลบกำหนดการตัดรอบของ "${row.warehouse_name}" ใช่หรือไม่?`)) return;
    setDeleting(row.med_period_id);
    try {
      await extraReportApi.deleteCutOff(row.med_period_id);
      toast.success('ลบเรียบร้อย');
      if (selected === row.med_period_id) setSelected(null);
      await load();
    } catch (err: any) { toast.error(err?.message || 'เกิดข้อผิดพลาด'); }
    finally { setDeleting(null); }
  };

  const handleExecute = async (row: CutOffPeriod, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExecuting(row.med_period_id);
    try {
      const res = await extraReportApi.executeCutOff(row.med_period_id);
      const s = res.data?.summary;
      const log: RunLog = {
        warehouse_name: row.warehouse_name,
        executed_at: new Date().toISOString(),
        status: 'success',
        ...s,
      };
      setLogs(prev => [log, ...prev].slice(0, 30));
      toast.success(`ตัดรอบ "${row.warehouse_name}" สำเร็จ`, { duration: 5000 });
      await load();
    } catch (err: any) {
      setLogs(prev => [{ warehouse_name: row.warehouse_name, executed_at: new Date().toISOString(), status: 'error', error: err?.message } as RunLog, ...prev].slice(0, 30));
      toast.error(err?.message || 'เกิดข้อผิดพลาด');
    } finally { setExecuting(null); }
  };

  const selectedPeriod = periods.find(p => p.med_period_id === selected) ?? null;
  const active = periods.filter(p => p.is_active);
  const ran24h = periods.filter(p => p.last_executed_at && (Date.now() - new Date(p.last_executed_at).getTime()) < 86400000);

  const numOpts = (min: number, max: number) =>
    Array.from({ length: max - min + 1 }, (_, i) => ({ value: String(min + i), label: String(min + i) }));

  return (
    <MainLayout
      title="สรุปการตัดรอบ"
      subtitle="จัดการและติดตาม Cut-off Period ทุกคลังยา"
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load} loading={loading}>รีเฟรช</Button>
          <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={openAdd}>เพิ่มกำหนดการ</Button>
        </div>
      }
    >
      {loading ? (
        <div className="flex justify-center py-24"><Spinner size={32} /></div>
      ) : (
        <div className="space-y-6">

          {/* KPI */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'คลังยาทั้งหมด', value: periods.length, icon: <Warehouse size={20} />, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-100' },
              { label: 'ใช้งานอยู่', value: active.length, icon: <CheckCircle2 size={20} />, color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-100' },
              { label: 'รันแล้วใน 24 ชม.', value: ran24h.length, icon: <Clock size={20} />, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-100' },
              { label: 'รันใน session นี้', value: logs.filter(l => l.status === 'success').length, icon: <CalendarClock size={20} />, color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-100' },
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

          {periods.length === 0 ? (
            <Card className="py-16">
              <EmptyState
                icon={<CalendarClock size={40} />}
                title="ยังไม่มีกำหนดการตัดรอบ"
                description="กดปุ่ม 'เพิ่มกำหนดการ' เพื่อตั้งค่าการตัดรอบให้แต่ละคลังยา"
              />
              <div className="flex justify-center mt-4">
                <Button variant="primary" icon={<Plus size={14} />} onClick={openAdd}>เพิ่มกำหนดการแรก</Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-3 gap-5">
              {/* Warehouse list */}
              <div className="col-span-1 space-y-2">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Warehouse size={15} className="text-slate-400" /> รายการคลัง ({periods.length})
                </h3>
                {periods.map(row => {
                  const isSelected = selected === row.med_period_id;
                  return (
                    <div key={row.med_period_id} onClick={() => setSelected(row.med_period_id)}
                      className={`rounded-xl border p-3 cursor-pointer transition-all ${isSelected ? 'border-blue-400 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold truncate ${isSelected ? 'text-blue-800' : 'text-slate-800'}`}>{row.warehouse_name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{fmtSched(row)}</p>
                        </div>
                        <Badge variant={row.is_active ? 'success' : 'gray'}>{row.is_active ? 'ใช้งาน' : 'ปิด'}</Badge>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1"><Clock size={10} />{timeSince(row.last_executed_at)}</p>
                      <div className="flex gap-1.5 mt-2">
                        <Button size="sm" variant={isSelected ? 'primary' : 'secondary'} icon={<Play size={11} />}
                          loading={executing === row.med_period_id} onClick={e => handleExecute(row, e)}>ตัดรอบ</Button>
                        <Button size="sm" variant="secondary" icon={<Pencil size={11} />} onClick={e => openEdit(row, e)} />
                        <Button size="sm" variant="secondary" icon={<Trash2 size={11} />}
                          loading={deleting === row.med_period_id} onClick={e => handleDelete(row, e)} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detail + log */}
              <div className="col-span-2 space-y-4">
                {selectedPeriod && (
                  <Card>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-base font-bold text-slate-800">{selectedPeriod.warehouse_name}</h3>
                        <p className="text-xs text-slate-500">รายละเอียดกำหนดการตัดรอบ</p>
                      </div>
                      <Badge variant={selectedPeriod.is_active ? 'success' : 'gray'} dot>
                        {selectedPeriod.is_active ? 'ใช้งาน' : 'ปิดการใช้งาน'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      {[
                        { label: 'วันที่กำหนด', value: `${selectedPeriod.period_day} ${MONTHS[selectedPeriod.period_month]}` },
                        { label: 'เวลาที่กำหนด', value: `${pad(selectedPeriod.period_time_h)}:${pad(selectedPeriod.period_time_m)} น.` },
                        { label: 'รันล่าสุด', value: selectedPeriod.last_executed_at ? fmtDate(selectedPeriod.last_executed_at, true) : '—' },
                        { label: 'นานแค่ไหน', value: timeSince(selectedPeriod.last_executed_at) },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-slate-50 rounded-lg p-3">
                          <p className="text-[11px] text-slate-500">{label}</p>
                          <p className="text-sm font-semibold text-slate-800 mt-1">{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="secondary" icon={<Pencil size={14} />} onClick={e => openEdit(selectedPeriod, e)}>แก้ไข</Button>
                      <Button variant="primary" icon={<Play size={14} />}
                        loading={executing === selectedPeriod.med_period_id}
                        onClick={() => handleExecute(selectedPeriod)}>ดำเนินการตัดรอบทันที</Button>
                    </div>
                  </Card>
                )}

                {/* Log */}
                <Card className="overflow-hidden p-0">
                  <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <CalendarClock size={15} className="text-slate-400" /> ประวัติการรัน (session นี้)
                    </h3>
                    <span className="text-xs text-slate-400">{logs.length} รายการ</span>
                  </div>
                  {logs.length === 0 ? (
                    <div className="py-10">
                      <EmptyState icon={<CalendarClock size={32} />} title="ยังไม่มีประวัติ" description="กดปุ่ม 'ตัดรอบ' เพื่อเริ่มต้น" />
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                      {logs.map((log, i) => (
                        <div key={i} className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50/50">
                          {log.status === 'success'
                            ? <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                            : <XCircle size={16} className="text-red-500 mt-0.5 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-slate-800">{log.warehouse_name}</span>
                              <Badge variant={log.status === 'success' ? 'success' : 'danger'}>{log.status === 'success' ? 'สำเร็จ' : 'ล้มเหลว'}</Badge>
                              <span className="text-xs text-slate-400 ml-auto">{fmtDate(log.executed_at, true)}</span>
                            </div>
                            {log.status === 'success' && (
                              <div className="mt-1 flex flex-wrap gap-3">
                                <span className="flex items-center gap-1 text-[11px] text-red-600"><PackageX size={11} />หมดอายุ <strong>{log.newly_expired_count}</strong></span>
                                <span className="flex items-center gap-1 text-[11px] text-amber-600"><AlertTriangle size={11} />ใกล้หมดอายุ <strong>{log.near_expiry_count}</strong></span>
                                <span className="flex items-center gap-1 text-[11px] text-blue-600"><Package size={11} />สต็อกต่ำ <strong>{log.low_stock_count}</strong></span>
                                <span className="text-[11px] text-slate-400">Snapshot <strong>{log.snapshot_count}</strong></span>
                              </div>
                            )}
                            {log.status === 'error' && <p className="mt-1 text-xs text-red-500">{log.error}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editRow ? 'แก้ไขกำหนดการตัดรอบ' : 'เพิ่มกำหนดการตัดรอบ'}>
        <div className="space-y-4 py-1">
          {!editRow && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">คลังยา *</label>
              {warehouses.length === 0
                ? <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">ไม่พบคลังยา — กรุณาเพิ่มคลังยาก่อน</p>
                : <Select
                    placeholder="เลือกคลังยา"
                    value={form.sub_warehouse_id}
                    onChange={e => setForm(f => ({ ...f, sub_warehouse_id: e.target.value }))}
                    options={warehouses.map(w => ({ value: String(w.sub_warehouse_id), label: w.name }))}
                  />}
            </div>
          )}
          {editRow && (
            <div className="bg-slate-50 rounded-lg px-3 py-2 text-sm font-medium text-slate-700">
              📦 {editRow.warehouse_name}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">เดือน (1-12)</label>
              <Select value={form.period_month} onChange={e => setForm(f => ({ ...f, period_month: e.target.value }))}
                options={numOpts(1, 12).map(o => ({ ...o, label: `${o.label} - ${MONTHS[Number(o.value)]}` }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">วัน (1-31)</label>
              <Select value={form.period_day} onChange={e => setForm(f => ({ ...f, period_day: e.target.value }))}
                options={numOpts(1, 31)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">ชั่วโมง (0-23)</label>
              <Select value={form.period_time_h} onChange={e => setForm(f => ({ ...f, period_time_h: e.target.value }))}
                options={numOpts(0, 23)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">นาที (0-59)</label>
              <Select value={form.period_time_m} onChange={e => setForm(f => ({ ...f, period_time_m: e.target.value }))}
                options={numOpts(0, 59)} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input type="checkbox" id="is_active" checked={form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
              className="w-4 h-4 accent-blue-600" />
            <label htmlFor="is_active" className="text-sm text-slate-700">เปิดใช้งาน (อัตโนมัติรันตามเวลา)</label>
          </div>

          <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-700">
            กำหนด: ทุกวันที่ {form.period_day || '?'} {MONTHS[Number(form.period_month)] || '?'} เวลา {pad(Number(form.period_time_h))}:{pad(Number(form.period_time_m))} น.
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" onClick={() => setShowModal(false)}>ยกเลิก</Button>
            <Button variant="primary" loading={saving} onClick={handleSave}>
              {editRow ? 'บันทึกการแก้ไข' : 'เพิ่มกำหนดการ'}
            </Button>
          </div>
        </div>
      </Modal>
    </MainLayout>
  );
}
