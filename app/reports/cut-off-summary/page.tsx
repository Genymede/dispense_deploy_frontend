'use client';
import { useEffect, useState, useCallback } from 'react';
import MainLayout from '@/components/MainLayout';
import { Card, Button, Badge, Spinner, EmptyState, Modal, Select } from '@/components/ui';
import { extraReportApi } from '@/lib/api';
import { fmtDate } from '@/lib/dateUtils';
import toast from 'react-hot-toast';
import {
  CalendarClock, Play, CheckCircle2, XCircle,
  AlertTriangle, PackageX, Package, Clock,
  RefreshCw, Warehouse, Plus, Pencil, Trash2,
  FileText, FileSpreadsheet,
} from 'lucide-react';

// ── Export helpers (same pattern as expiry report) ────────────────────────────
const toB64 = (buf: ArrayBuffer) => {
  const b = new Uint8Array(buf); let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
};

async function exportPDF(title: string, columns: string[], rows: string[][]) {
  const { default: jsPDF }     = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const [regularBuf, boldBuf, logoBuf] = await Promise.all([
    fetch('/font/ThaiSarabun/subset-Sarabun-Regular.ttf').then(r => r.arrayBuffer()),
    fetch('/font/ThaiSarabun/subset-Sarabun-Bold.ttf').then(r => r.arrayBuffer()),
    fetch('/logo.png').then(r => r.arrayBuffer()).catch(() => null),
  ]);
  doc.addFileToVFS('Sarabun.ttf', toB64(regularBuf));
  doc.addFont('Sarabun.ttf', 'Sarabun', 'normal');
  doc.addFileToVFS('Sarabun-Bold.ttf', toB64(boldBuf));
  doc.addFont('Sarabun-Bold.ttf', 'Sarabun', 'bold');
  const W = doc.internal.pageSize.getWidth();
  const currentDate = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  const drawHeader = (data: any) => {
    const pageCount = (doc.internal as any).getNumberOfPages();
    if (logoBuf) { try { doc.addImage(toB64(logoBuf as ArrayBuffer), 'PNG', 10, 8, 20, 20); } catch {} }
    doc.setFont('Sarabun', 'bold'); doc.setFontSize(13);
    doc.text('โรงพยาบาลวัดห้วยปลากั้งเพื่อสังคม', W / 2, 14, { align: 'center' });
    doc.setFont('Sarabun', 'normal'); doc.setFontSize(9);
    doc.text('553 11 ตำบล บ้านดู่ อำเภอเมืองเชียงราย เชียงราย 57100', W / 2, 20, { align: 'center' });
    doc.text(`โทร: 052 029 888   |   วันที่: ${currentDate}`, W / 2, 26, { align: 'center' });
    doc.setFont('Sarabun', 'bold'); doc.setFontSize(11);
    doc.text(title, W / 2, 34, { align: 'center' });
    doc.setDrawColor('#006FC6'); doc.setLineWidth(0.4);
    doc.line(10, 38, W - 10, 38);
    doc.setFont('Sarabun', 'normal'); doc.setFontSize(8); doc.setTextColor(150);
    doc.text(`หน้า ${data.pageNumber} จาก ${pageCount}`, W - 10, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
    doc.setTextColor(0);
  };
  autoTable(doc, {
    startY: 42, head: [columns], body: rows,
    styles: { font: 'Sarabun', fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { font: 'Sarabun', fontStyle: 'bold', fillColor: [0, 111, 198], textColor: 255, fontSize: 8 },
    alternateRowStyles: { fillColor: [240, 247, 255] },
    margin: { top: 42, left: 10, right: 10, bottom: 15 },
    didDrawPage: drawHeader,
  });
  doc.save(`${title}.pdf`);
}

function exportCSV(title: string, columns: string[], rows: string[][]) {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = '\uFEFF' + [columns.map(esc), ...rows.map(r => r.map(esc))].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${title}.csv`; a.click();
  URL.revokeObjectURL(url);
}

interface SubWarehouse { sub_warehouse_id: number; name: string; is_active: boolean; }
interface CutOffPeriod {
  med_period_id: number; sub_warehouse_id: number; warehouse_name: string;
  period_month: number; period_day: number; period_time_h: number; period_time_m: number;
  is_active: boolean; last_executed_at: string | null; frequency?: string;
}
interface LotDetail {
  lot_id: number; lot_number: string; med_sid: number;
  med_showname: string; exp_date: string; quantity: number; days_remaining?: number;
}
interface RunLog {
  warehouse_name: string; executed_at: string; status: 'success' | 'error'; error?: string;
  newly_expired_count?: number; near_expiry_count?: number; low_stock_count?: number; snapshot_count?: number;
  expired_lots?: LotDetail[]; near_expiry_lots?: LotDetail[];
}

const MONTHS = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const DOW_TH = ['', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
const pad = (n: number) => String(n ?? 0).padStart(2, '0');
const fmtSched = (r: CutOffPeriod) => {
  const t = `${pad(r.period_time_h)}:${pad(r.period_time_m)} น.`;
  const freq = r.frequency || 'monthly';
  if (freq === 'daily')   return `ทุกวัน เวลา ${t}`;
  if (freq === 'weekly')  return `ทุกวัน${DOW_TH[r.period_day] || r.period_day} เวลา ${t}`;
  if (freq === 'monthly') return `ทุกวันที่ ${r.period_day} เวลา ${t}`;
  return `${r.period_day} ${MONTHS[r.period_month]} เวลา ${t}`;
};
const timeSince = (iso: string | null) => {
  if (!iso) return 'ยังไม่เคยรัน';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ชม.ที่แล้ว`;
  return `${Math.floor(h / 24)} วันที่แล้ว`;
};

const FREQ_OPTIONS = [
  { value: 'daily',   label: 'รายวัน — ทุกวันตามเวลาที่กำหนด' },
  { value: 'weekly',  label: 'รายสัปดาห์ — เลือกวันในสัปดาห์' },
  { value: 'monthly', label: 'รายเดือน — เลือกวันที่ในเดือน' },
  { value: 'yearly',  label: 'รายปี — เลือกวันที่ + เดือน' },
];
const emptyForm = { sub_warehouse_id: '', frequency: 'monthly', period_month: '1', period_day: '1', period_time_h: '0', period_time_m: '0', is_active: true };

export default function CutOffSummaryPage() {
  const [periods, setPeriods] = useState<CutOffPeriod[]>([]);
  const [warehouses, setWarehouses] = useState<SubWarehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState<number | null>(null);
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);
  const [reportLog, setReportLog] = useState<RunLog | null>(null); // per-run report modal

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
      frequency: row.frequency || 'monthly',
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
        frequency: form.frequency,
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

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExport = async (type: 'pdf' | 'csv') => {
    const title = 'รายงานสรุปการตัดรอบคลังยา';
    const columns = ['คลังยา', 'ความถี่', 'กำหนดการ', 'สถานะ', 'รันล่าสุด', 'นานแค่ไหน'];
    const rows = periods.map(r => [
      r.warehouse_name,
      r.frequency === 'daily'   ? 'รายวัน'    :
      r.frequency === 'weekly'  ? 'รายสัปดาห์' :
      r.frequency === 'monthly' ? 'รายเดือน'  : 'รายปี',
      fmtSched(r),
      r.is_active ? 'ใช้งาน' : 'ปิดการใช้งาน',
      r.last_executed_at ? fmtDate(r.last_executed_at, true) : 'ยังไม่เคยรัน',
      timeSince(r.last_executed_at),
    ]);
    setExporting(type);
    try {
      if (type === 'pdf') await exportPDF(title, columns, rows);
      else exportCSV(title, columns, rows);
    } catch (e: any) { toast.error('ออกรายงานไม่สำเร็จ: ' + e.message); }
    finally { setExporting(null); }
  };

  const handleExportLog = async (type: 'pdf' | 'csv') => {
    const title = 'ประวัติการตัดรอบ (session นี้)';
    const columns = ['คลังยา', 'เวลาที่รัน', 'สถานะ', 'หมดอายุ', 'ใกล้หมดอายุ', 'สต็อกต่ำ', 'Snapshot'];
    const rows = logs.map(l => [
      l.warehouse_name,
      fmtDate(l.executed_at, true),
      l.status === 'success' ? 'สำเร็จ' : 'ล้มเหลว',
      String(l.newly_expired_count ?? (l.status === 'error' ? '-' : 0)),
      String(l.near_expiry_count  ?? (l.status === 'error' ? '-' : 0)),
      String(l.low_stock_count    ?? (l.status === 'error' ? '-' : 0)),
      String(l.snapshot_count     ?? (l.status === 'error' ? '-' : 0)),
    ]);
    setExporting(type);
    try {
      if (type === 'pdf') await exportPDF(title, columns, rows);
      else exportCSV(title, columns, rows);
    } catch (e: any) { toast.error('ออกรายงานไม่สำเร็จ: ' + e.message); }
    finally { setExporting(null); }
  };

  const handleExportRunReport = async (log: RunLog, type: 'pdf' | 'csv') => {
    const dt = fmtDate(log.executed_at, true);
    const title = `รายงานตัดรอบ ${log.warehouse_name} (${dt})`;

    const expCols = ['ชื่อยา', 'เลข Lot', 'วันหมดอายุ', 'คงเหลือ'];
    const expRows = (log.expired_lots ?? []).map(l => [
      l.med_showname, l.lot_number || '—', fmtDate(l.exp_date), String(l.quantity),
    ]);
    const nearCols = ['ชื่อยา', 'เลข Lot', 'วันหมดอายุ', 'คงเหลือ', 'อีกกี่วัน'];
    const nearRows = (log.near_expiry_lots ?? []).map(l => [
      l.med_showname, l.lot_number || '—', fmtDate(l.exp_date), String(l.quantity), `${l.days_remaining} วัน`,
    ]);

    setExporting(type);
    try {
      if (type === 'pdf') {
        const { default: jsPDF }     = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
        const [rBuf, bBuf, logo] = await Promise.all([
          fetch('/font/ThaiSarabun/subset-Sarabun-Regular.ttf').then(r => r.arrayBuffer()),
          fetch('/font/ThaiSarabun/subset-Sarabun-Bold.ttf').then(r => r.arrayBuffer()),
          fetch('/logo.png').then(r => r.arrayBuffer()).catch(() => null),
        ]);
        doc.addFileToVFS('Sarabun.ttf', toB64(rBuf)); doc.addFont('Sarabun.ttf', 'Sarabun', 'normal');
        doc.addFileToVFS('SaraNew.ttf', toB64(bBuf));  doc.addFont('SaraNew.ttf',  'Sarabun', 'bold');
        const W = doc.internal.pageSize.getWidth();
        const drawHdr = (data: any) => {
          if (logo) { try { doc.addImage(toB64(logo as ArrayBuffer), 'PNG', 10, 8, 18, 18); } catch {} }
          doc.setFont('Sarabun','bold'); doc.setFontSize(12);
          doc.text('โรงพยาบาลวัดห้วยปลากั้งเพื่อสังคม', W/2, 14, { align:'center' });
          doc.setFont('Sarabun','normal'); doc.setFontSize(9);
          doc.text(`รายงานตัดรอบ: ${log.warehouse_name}  |  วันที่: ${dt}`, W/2, 21, { align:'center' });
          doc.setFont('Sarabun','bold'); doc.setFontSize(10);
          doc.text(data.pageNumber === 1 ? 'ยาหมดอายุ / ใกล้หมดอายุ' : title, W/2, 30, { align:'center' });
          doc.setDrawColor('#DC2626'); doc.setLineWidth(0.4); doc.line(10, 34, W-10, 34);
          doc.setFont('Sarabun','normal'); doc.setFontSize(7); doc.setTextColor(150);
          doc.text(`หน้า ${data.pageNumber}`, W-10, doc.internal.pageSize.getHeight()-8, { align:'right' });
          doc.setTextColor(0);
        };
        // Section: expired
        doc.setFont('Sarabun','bold'); doc.setFontSize(10);
        doc.text(`• ยาหมดอายุ (${expRows.length} Lot)`, 10, 40);
        autoTable(doc, { startY: 44, head: [expCols], body: expRows.length ? expRows : [['— ไม่มีรายการ —','','','']], styles:{font:'Sarabun',fontSize:8,cellPadding:2}, headStyles:{font:'Sarabun',fontStyle:'bold',fillColor:[220,38,38],textColor:255,fontSize:8}, alternateRowStyles:{fillColor:[255,245,245]}, margin:{top:38,left:10,right:10,bottom:15}, didDrawPage: drawHdr });
        const afterExp = (doc as any).lastAutoTable.finalY + 8;
        doc.setFont('Sarabun','bold'); doc.setFontSize(10);
        doc.text(`• ยาใกล้หมดอายุ ≤ 30 วัน (${nearRows.length} Lot)`, 10, afterExp);
        autoTable(doc, { startY: afterExp + 4, head: [nearCols], body: nearRows.length ? nearRows : [['— ไม่มีรายการ —','','','','']], styles:{font:'Sarabun',fontSize:8,cellPadding:2}, headStyles:{font:'Sarabun',fontStyle:'bold',fillColor:[217,119,6],textColor:255,fontSize:8}, alternateRowStyles:{fillColor:[255,251,235]}, margin:{top:38,left:10,right:10,bottom:15}, didDrawPage: drawHdr });
        doc.save(`${title}.pdf`);
      } else {
        const esc = (v: string) => `"${String(v).replace(/"/g,'""')}"`;
        let csv = '\uFEFFยาหมดอายุ\n' + [expCols, ...expRows].map(r => r.map(esc).join(',')).join('\n');
        csv += '\n\nยาใกล้หมดอายุ\n' + [nearCols, ...nearRows].map(r => r.map(esc).join(',')).join('\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a'); a.href = url; a.download = `${title}.csv`; a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e: any) { toast.error('ออกรายงานไม่สำเร็จ: ' + e.message); }
    finally { setExporting(null); }
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
      setReportLog(log); // เปิด report modal ทันที
      toast.success(`ตัดรอบ "${row.warehouse_name}" สำเร็จ`, { duration: 4000 });
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
          <Button variant="secondary" size="sm" icon={<FileSpreadsheet size={13}/>}
            loading={exporting === 'csv'} onClick={() => handleExport('csv')}>CSV</Button>
          <Button variant="secondary" size="sm" icon={<FileText size={13}/>}
            loading={exporting === 'pdf'} onClick={() => handleExport('pdf')}>PDF</Button>
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
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{logs.length} รายการ</span>
                      {logs.length > 0 && (
                        <>
                          <Button size="sm" variant="secondary" icon={<FileSpreadsheet size={11}/>}
                            loading={exporting === 'csv'} onClick={() => handleExportLog('csv')}>CSV</Button>
                          <Button size="sm" variant="secondary" icon={<FileText size={11}/>}
                            loading={exporting === 'pdf'} onClick={() => handleExportLog('pdf')}>PDF</Button>
                        </>
                      )}
                    </div>
                  </div>
                  {logs.length === 0 ? (
                    <div className="py-10">
                      <EmptyState icon={<CalendarClock size={32} />} title="ยังไม่มีประวัติ" description="กดปุ่ม 'ตัดรอบ' เพื่อเริ่มต้น" />
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                      {logs.map((log, i) => (
                        <div key={i} className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50/50 cursor-pointer" onClick={() => setReportLog(log)}>
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
                                <span className="flex items-center gap-1 text-[11px] text-red-600"><PackageX size={11}/>หมดอายุ <strong>{log.newly_expired_count}</strong> lot</span>
                                <span className="flex items-center gap-1 text-[11px] text-amber-600"><AlertTriangle size={11}/>ใกล้หมดอายุ <strong>{log.near_expiry_count}</strong> lot</span>
                                <span className="flex items-center gap-1 text-[11px] text-blue-600"><Package size={11}/>สต็อกต่ำ <strong>{log.low_stock_count}</strong></span>
                                <button className="text-[11px] text-blue-600 underline ml-auto" onClick={e => { e.stopPropagation(); setReportLog(log); }}>ดูรายงาน</button>
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
                : <Select placeholder="เลือกคลังยา" value={form.sub_warehouse_id}
                    onChange={e => setForm(f => ({ ...f, sub_warehouse_id: e.target.value }))}
                    options={warehouses.map(w => ({ value: String(w.sub_warehouse_id), label: w.name }))} />}
            </div>
          )}
          {editRow && (
            <div className="bg-slate-50 rounded-lg px-3 py-2 text-sm font-medium text-slate-700">📦 {editRow.warehouse_name}</div>
          )}

          {/* Frequency */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">ความถี่การตัดรอบ</label>
            <Select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} options={FREQ_OPTIONS} />
          </div>

          {/* Day of week — weekly only */}
          {form.frequency === 'weekly' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">วันในสัปดาห์</label>
              <Select value={form.period_day}
                onChange={e => setForm(f => ({ ...f, period_day: e.target.value }))}
                options={DOW_TH.slice(1).map((d, i) => ({ value: String(i + 1), label: d }))} />
            </div>
          )}

          {/* Day of month — monthly / yearly */}
          {(form.frequency === 'monthly' || form.frequency === 'yearly') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">วันที่ (1-31)</label>
                <Select value={form.period_day} onChange={e => setForm(f => ({ ...f, period_day: e.target.value }))} options={numOpts(1, 31)} />
              </div>
              {form.frequency === 'yearly' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">เดือน</label>
                  <Select value={form.period_month} onChange={e => setForm(f => ({ ...f, period_month: e.target.value }))}
                    options={numOpts(1, 12).map(o => ({ ...o, label: `${o.label} - ${MONTHS[Number(o.value)]}` }))} />
                </div>
              )}
            </div>
          )}

          {/* Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">ชั่วโมง (0-23)</label>
              <Select value={form.period_time_h} onChange={e => setForm(f => ({ ...f, period_time_h: e.target.value }))} options={numOpts(0, 23)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">นาที (0-59)</label>
              <Select value={form.period_time_m} onChange={e => setForm(f => ({ ...f, period_time_m: e.target.value }))} options={numOpts(0, 59)} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input type="checkbox" id="is_active" checked={form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
              className="w-4 h-4 accent-blue-600" />
            <label htmlFor="is_active" className="text-sm text-slate-700">เปิดใช้งาน (อัตโนมัติรันตามเวลา)</label>
          </div>

          <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-700">
            📅 {
              form.frequency === 'daily'   ? `ทุกวัน เวลา ${pad(+form.period_time_h)}:${pad(+form.period_time_m)} น.` :
              form.frequency === 'weekly'  ? `ทุกวัน${DOW_TH[+form.period_day] || ''} เวลา ${pad(+form.period_time_h)}:${pad(+form.period_time_m)} น.` :
              form.frequency === 'monthly' ? `ทุกวันที่ ${form.period_day} เวลา ${pad(+form.period_time_h)}:${pad(+form.period_time_m)} น.` :
              `${form.period_day} ${MONTHS[+form.period_month] || ''} เวลา ${pad(+form.period_time_h)}:${pad(+form.period_time_m)} น.`
            }
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" onClick={() => setShowModal(false)}>ยกเลิก</Button>
            <Button variant="primary" loading={saving} onClick={handleSave}>
              {editRow ? 'บันทึกการแก้ไข' : 'เพิ่มกำหนดการ'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Per-run Report Modal */}
      {reportLog && (
        <Modal open={!!reportLog} onClose={() => setReportLog(null)}
          title={`รายงานตัดรอบ — ${reportLog.warehouse_name}`}>
          <div className="space-y-4 py-1">
            {/* Summary KPI */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'หมดอายุ', value: `${reportLog.newly_expired_count ?? 0} lot`, color: 'text-red-700 bg-red-50 border-red-100' },
                { label: 'ใกล้หมดอายุ', value: `${reportLog.near_expiry_count ?? 0} lot`, color: 'text-amber-700 bg-amber-50 border-amber-100' },
                { label: 'สต็อกต่ำ', value: `${reportLog.low_stock_count ?? 0} รายการ`, color: 'text-blue-700 bg-blue-50 border-blue-100' },
              ].map(({ label, value, color }) => (
                <div key={label} className={`rounded-lg border p-3 ${color}`}>
                  <p className="text-xs opacity-70">{label}</p>
                  <p className="text-lg font-bold mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {/* Expired lots table */}
            <div>
              <h4 className="text-sm font-semibold text-red-700 mb-1.5 flex items-center gap-1.5">
                <PackageX size={14}/> ยาหมดอายุ ({(reportLog.expired_lots ?? []).length} lot)
              </h4>
              {(reportLog.expired_lots ?? []).length === 0
                ? <p className="text-xs text-slate-400 pl-1">ไม่มียาหมดอายุในรอบนี้</p>
                : <div className="overflow-x-auto rounded-lg border border-red-100 max-h-44 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-red-50 sticky top-0">
                        <tr>{['ชื่อยา','เลข Lot','วันหมดอายุ','คงเหลือ'].map(h => <th key={h} className="px-3 py-2 text-left text-red-700 font-semibold whitespace-nowrap">{h}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-red-50">
                        {(reportLog.expired_lots ?? []).map(l => (
                          <tr key={l.lot_id} className="hover:bg-red-50/50">
                            <td className="px-3 py-1.5 font-medium text-slate-800">{l.med_showname}</td>
                            <td className="px-3 py-1.5 font-mono text-slate-600">{l.lot_number || '—'}</td>
                            <td className="px-3 py-1.5 text-red-600">{fmtDate(l.exp_date)}</td>
                            <td className="px-3 py-1.5">{l.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>}
            </div>

            {/* Near-expiry lots table */}
            <div>
              <h4 className="text-sm font-semibold text-amber-700 mb-1.5 flex items-center gap-1.5">
                <AlertTriangle size={14}/> ยาใกล้หมดอายุ ≤ 30 วัน ({(reportLog.near_expiry_lots ?? []).length} lot)
              </h4>
              {(reportLog.near_expiry_lots ?? []).length === 0
                ? <p className="text-xs text-slate-400 pl-1">ไม่มียาใกล้หมดอายุในรอบนี้</p>
                : <div className="overflow-x-auto rounded-lg border border-amber-100 max-h-44 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-amber-50 sticky top-0">
                        <tr>{['ชื่อยา','เลข Lot','วันหมดอายุ','คงเหลือ','อีกกี่วัน'].map(h => <th key={h} className="px-3 py-2 text-left text-amber-700 font-semibold whitespace-nowrap">{h}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-amber-50">
                        {(reportLog.near_expiry_lots ?? []).map(l => (
                          <tr key={l.lot_id} className="hover:bg-amber-50/50">
                            <td className="px-3 py-1.5 font-medium text-slate-800">{l.med_showname}</td>
                            <td className="px-3 py-1.5 font-mono text-slate-600">{l.lot_number || '—'}</td>
                            <td className="px-3 py-1.5 text-amber-600">{fmtDate(l.exp_date)}</td>
                            <td className="px-3 py-1.5">{l.quantity}</td>
                            <td className="px-3 py-1.5 font-semibold text-amber-700">{l.days_remaining} วัน</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>}
            </div>

            {/* Export buttons */}
            <div className="flex gap-2 justify-end pt-1 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setReportLog(null)}>ปิด</Button>
              <Button variant="secondary" icon={<FileSpreadsheet size={13}/>}
                loading={exporting === 'csv'} onClick={() => handleExportRunReport(reportLog, 'csv')}>CSV</Button>
              <Button variant="primary" icon={<FileText size={13}/>}
                loading={exporting === 'pdf'} onClick={() => handleExportRunReport(reportLog, 'pdf')}>ออกรายงาน PDF</Button>
            </div>
          </div>
        </Modal>
      )}
    </MainLayout>
  );
}
