'use client';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { Badge } from '@/components/ui';
import { extraReportApi } from '@/lib/api';
import { Repeat2 } from 'lucide-react';

const COLS: ColDef[] = [
  { key:'drug1_name', label:'ยา 1',
    render: r => <><p className="font-medium">{r.drug1_name}</p><p className="text-xs text-slate-400">{r.drug1_generic}</p></>,
    exportValue: r => r.drug1_name??'-' },
  { key:'drug2_name', label:'ยา 2',
    render: r => <><p className="font-medium">{r.drug2_name}</p><p className="text-xs text-slate-400">{r.drug2_generic}</p></>,
    exportValue: r => r.drug2_name??'-' },
  { key:'interaction_type', label:'ประเภท', className:'text-xs' },
  { key:'severity', label:'ระดับ',
    render: r => <Badge variant={r.severity==='severe'?'danger':r.severity?'warning':'gray'}>{r.severity||'-'}</Badge>,
    exportValue: r => r.severity??'-' },
  { key:'description', label:'คำอธิบาย', className:'text-xs max-w-[260px] truncate' },
  { key:'recorded_by_name', label:'ผู้บันทึก', className:'text-xs text-slate-500',
    exportValue: r => r.recorded_by_name??'-' },
];

export default function MedInteractionPage() {
  return (
    <MainLayout title="รายงานปฏิกิริยายา" subtitle="Drug Interaction Report">
      <DataTable cols={COLS}
        fetcher={p => extraReportApi.getMedInteraction(p).then((r:any) => ({ data:r.data.data??r.data, total:r.data.total??0 }))}
        filters={[{ key:'search', type:'search', placeholder:'ค้นหาชื่อยา...' }]}
        exportTitle="รายงานปฏิกิริยายา"
        emptyIcon={<Repeat2 size={36}/>} emptyText="ไม่พบรายการ"
        deps={[]} />
    </MainLayout>
  );
}
