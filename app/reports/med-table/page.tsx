'use client';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { Badge } from '@/components/ui';
import { extraReportApi } from '@/lib/api';
import { BookOpen } from 'lucide-react';

const PREG_TH: Record<string, string> = { A: 'A — ปลอดภัย', B: 'B — ค่อนข้างปลอดภัย', C: 'C — ระวัง', D: 'D — มีความเสี่ยง', X: 'X — ห้ามใช้' };

const COLS: ColDef[] = [
  { key: 'med_name', label: 'ชื่อยา',
    render: r => <><p className="font-medium text-slate-800">{r.med_name}</p><p className="text-xs text-slate-400">{r.med_thai_name}</p></>,
    exportValue: r => r.med_name ?? '-' },
  { key: 'med_marketing_name', label: 'ชื่อการค้า', className: 'text-xs text-slate-600',
    exportValue: r => r.med_marketing_name ?? '-' },
  { key: 'med_generic_name', label: 'ชื่อสามัญ', className: 'text-xs text-slate-600',
    exportValue: r => r.med_generic_name ?? '-' },
  { key: 'med_medical_category', label: 'หมวดหมู่', className: 'text-xs text-slate-500',
    exportValue: r => r.med_medical_category ?? '-' },
  { key: 'med_dosage_form', label: 'รูปแบบ', className: 'text-xs text-slate-500',
    exportValue: r => r.med_dosage_form ?? '-' },
  { key: 'med_counting_unit', label: 'หน่วย', className: 'text-xs',
    exportValue: r => r.med_counting_unit ?? '-' },
  { key: 'med_severity', label: 'ระดับ',
    render: r => <Badge variant={r.med_severity?.includes('เสพติด') ? 'danger' : r.med_severity?.includes('อันตราย') ? 'warning' : 'gray'} className="text-[10px]">{r.med_severity || '—'}</Badge>,
    exportValue: r => r.med_severity ?? '-' },
  { key: 'med_indication', label: 'ข้อบ่งใช้', className: 'text-xs text-slate-500',
    render: r => <span className="truncate block max-w-[200px]" title={r.med_indication}>{r.med_indication || '—'}</span>,
    exportValue: r => r.med_indication ?? '-' },
  { key: 'med_pregnancy_category', label: 'หมวดตั้งครรภ์',
    render: r => r.med_pregnancy_category
      ? <Badge variant={r.med_pregnancy_category === 'X' ? 'danger' : r.med_pregnancy_category === 'D' ? 'warning' : 'gray'} className="text-[10px]">{r.med_pregnancy_category}</Badge>
      : <span className="text-slate-300 text-xs">—</span>,
    exportValue: r => r.med_pregnancy_category ? (PREG_TH[r.med_pregnancy_category] ?? r.med_pregnancy_category) : '-' },
];

export default function MedTablePage() {
  return (
    <MainLayout title="รายงานทะเบียนยาหลัก" subtitle="Drug Master Table Report">
      <DataTable cols={COLS}
        fetcher={p => extraReportApi.getMedTable(p).then((r: any) => ({ data: r.data.data ?? r.data, total: r.data.total ?? 0 }))}
        filters={[{ key: 'search', type: 'search', placeholder: 'ค้นหาชื่อยา, ชื่อสามัญ...' }]}
        exportTitle="รายงานทะเบียนยาหลัก"
        emptyIcon={<BookOpen size={36} />} emptyText="ไม่พบรายการ"
        deps={[]} />
    </MainLayout>
  );
}
