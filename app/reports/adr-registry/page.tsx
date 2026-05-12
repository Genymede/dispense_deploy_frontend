'use client';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { Badge } from '@/components/ui';
import { extraReportApi } from '@/lib/api';
import { fmtDate } from '@/lib/dateUtils';
import { FlaskConical } from 'lucide-react';

const SEV: Record<string,string> = { severe:'รุนแรง', moderate:'ปานกลาง', mild:'เล็กน้อย' };

const COLS: ColDef[] = [
  { key:'patient_name', label:'ผู้ป่วย',
    render: r => <><p className="font-medium">{r.patient_name}</p><p className="text-xs text-slate-400">{r.hn_number}</p></>,
    exportValue: r => `${r.patient_name??'-'} (HN: ${r.hn_number??'-'})` },
  { key:'med_name', label:'ยา',
    render: r => <><p className="font-medium">{r.med_name}</p><p className="text-xs text-slate-400">{r.med_generic_name}</p></>,
    exportValue: r => r.med_name??'-' },
  { key:'symptoms', label:'อาการ', className:'text-xs max-w-[160px] truncate' },
  { key:'severity', label:'ระดับ',
    render: r => <Badge variant={r.severity==='severe'?'danger':r.severity==='moderate'?'warning':'gray'}>{SEV[r.severity]||r.severity||'-'}</Badge>,
    exportValue: r => SEV[r.severity]??r.severity??'-' },
  { key:'outcome', label:'ผลลัพธ์', className:'text-xs text-slate-500' },
  { key:'reporter_name', label:'ผู้รายงาน', className:'text-xs text-slate-500' },
  { key:'reported_at', label:'วันที่',
    render: r => fmtDate(r.reported_at),
    exportValue: r => fmtDate(r.reported_at) },
];

export default function AdrRegistryPage() {
  return (
    <MainLayout title="รายงาน ADR" subtitle="Adverse Drug Reaction Report">
      <DataTable cols={COLS}
        fetcher={p => extraReportApi.getAdrRegistry(p).then((r:any) => ({ data:r.data.data??r.data, total:r.data.total??0 }))}
        filters={[{ key:'search', type:'search', placeholder:'ค้นหาชื่อผู้ป่วย, ยา...' }]}
        exportTitle="รายงาน ADR"
        emptyIcon={<FlaskConical size={36}/>} emptyText="ไม่พบรายการ"
        deps={[]} />
    </MainLayout>
  );
}
