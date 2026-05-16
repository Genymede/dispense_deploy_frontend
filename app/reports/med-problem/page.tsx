'use client';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { Badge } from '@/components/ui';
import { extraReportApi } from '@/lib/api';
import { AlertTriangle } from 'lucide-react';
import { fmtDate } from '@/lib/dateUtils';

const COLS: ColDef[] = [
  { key:'med_name', label:'ชื่อยา',
    render: r => <p className="font-medium">{r.med_name||'-'}</p>,
    exportValue: r => r.med_name??'-' },
  { key:'problem_type', label:'ประเภท', className:'text-xs' },
  { key:'description', label:'คำอธิบาย', className:'text-xs max-w-[240px] truncate' },
  { key:'reported_by_name', label:'ผู้รายงาน', className:'text-xs text-slate-500' },
  { key:'is_resolved', label:'สถานะ',
    render: r => <Badge variant={r.is_resolved?'success':'warning'}>{r.is_resolved?'แก้ไขแล้ว':'ยังไม่แก้ไข'}</Badge>,
    exportValue: r => r.is_resolved ? 'แก้ไขแล้ว' : 'ยังไม่แก้ไข' },
  { key:'reported_at', label:'วันที่',
    render: r => fmtDate(r.reported_at),
    exportValue: r => fmtDate(r.reported_at) },
];

export default function MedProblemPage() {
  return (
    <MainLayout title="ปัญหาการใช้ยา" subtitle="Medication Problem Report">
      <DataTable cols={COLS}
        fetcher={p => extraReportApi.getMedProblem(p).then((r:any) => ({ data:r.data.data??r.data, total:r.data.total??0 }))}
        filters={[{ key:'search', type:'search', placeholder:'ค้นหาชื่อยา...' }]}
        exportTitle="ปัญหาการใช้ยา"
        emptyIcon={<AlertTriangle size={36}/>} emptyText="ไม่พบรายการ"
        deps={[]} />
    </MainLayout>
  );
}
