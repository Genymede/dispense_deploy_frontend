'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { Badge } from '@/components/ui';
import { extraReportApi } from '@/lib/api';
import { fmtDate } from '@/lib/dateUtils';
import RegistryDrawer from '@/components/RegistryDrawer';
import { ShieldAlert } from 'lucide-react';

const SEV_LABEL: Record<string,string> = { mild:'เล็กน้อย', moderate:'ปานกลาง', severe:'รุนแรง' };

const COLS: ColDef[] = [
  { key:'patient_name', label:'ผู้ป่วย',
    render: r => <><p className="font-medium">{r.patient_name}</p><p className="text-xs text-slate-400">{r.hn_number}</p></>,
    exportValue: r => `${r.patient_name??'-'} (HN: ${r.hn_number??'-'})` },
  { key:'med_name', label:'ยาที่แพ้',
    render: r => <><p className="font-medium">{r.med_name}</p><p className="text-xs text-slate-400">{r.med_generic_name}</p></>,
    exportValue: r => r.med_name??'-' },
  { key:'symptoms', label:'อาการ', className:'text-sm max-w-[200px] truncate' },
  { key:'severity', label:'ระดับ',
    render: r => <Badge variant={r.severity==='severe'?'danger':r.severity==='moderate'?'warning':'gray'}>{SEV_LABEL[r.severity]||r.severity||'-'}</Badge>,
    exportValue: r => SEV_LABEL[r.severity]??r.severity??'-' },
  { key:'reported_at', label:'วันที่',
    render: r => fmtDate(r.reported_at),
    exportValue: r => fmtDate(r.reported_at) },
];

export default function AllergyRegistryPage() {
  const [drawer, setDrawer] = useState<any|null>(null);
  return (
    <MainLayout title="รายงานการแพ้ยา" subtitle="Allergy Registry Report">
      <DataTable cols={COLS}
        fetcher={p => extraReportApi.getAllergyRegistry(p).then((r:any) => ({ data:r.data.data??r.data, total:r.data.total??0 }))}
        filters={[{ key:'search', type:'search', placeholder:'ค้นหาชื่อผู้ป่วย, ยา...' }]}
        exportTitle="รายงานการแพ้ยา"
        emptyIcon={<ShieldAlert size={36}/>} emptyText="ไม่พบรายการ"
        deps={[]} onRowClick={row => setDrawer(row)} />
      <RegistryDrawer open={!!drawer} onClose={() => setDrawer(null)} row={drawer}
        title="การแพ้ยา" subtitle={r => `${r.patient_name} · ${r.hn_number}`}
        fields={[
          { label:'ผู้ป่วย',     key:'_patient', type:'patient' as const },
          { label:'ยาที่แพ้',    key:'_drug',    type:'drug'    as const },
          { label:'อาการ',       key:'symptoms',    span:true },
          { label:'รายละเอียด', key:'description', span:true },
          { label:'ระดับ',       key:'severity' },
          { label:'วันที่',      key:'reported_at', type:'date' as const },
        ]} />
    </MainLayout>
  );
}
