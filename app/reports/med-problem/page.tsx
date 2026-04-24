'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { Badge } from '@/components/ui';
import { extraReportApi } from '@/lib/api';
import RegistryDrawer from '@/components/RegistryDrawer';
import { AlertTriangle } from 'lucide-react';

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
];

export default function MedProblemPage() {
  const [drawer, setDrawer] = useState<any|null>(null);
  return (
    <MainLayout title="ปัญหาการใช้ยา" subtitle="Medication Problem Report">
      <DataTable cols={COLS}
        fetcher={p => extraReportApi.getMedProblem(p).then((r:any) => ({ data:r.data.data??r.data, total:r.data.total??0 }))}
        filters={[{ key:'search', type:'search', placeholder:'ค้นหาชื่อยา...' }]}
        exportTitle="ปัญหาการใช้ยา"
        emptyIcon={<AlertTriangle size={36}/>} emptyText="ไม่พบรายการ"
        deps={[]} onRowClick={row => setDrawer(row)} />
      <RegistryDrawer open={!!drawer} onClose={() => setDrawer(null)} row={drawer}
        title={r => r.med_name||'ปัญหาการใช้ยา'} subtitle={r => r.problem_type||''}
        fields={[
          { label:'ชื่อยา',     key:'med_name' },
          { label:'ประเภท',     key:'problem_type' },
          { label:'ผู้รายงาน', key:'reported_by_name' },
          { label:'สถานะ',     key:'is_resolved', type:'template' as const, template: r => r.is_resolved ? 'แก้ไขแล้ว' : 'ยังไม่แก้ไข' },
          { label:'คำอธิบาย', key:'description', span:true },
        ]} />
    </MainLayout>
  );
}
