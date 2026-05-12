'use client';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { Badge } from '@/components/ui';
import { extraReportApi } from '@/lib/api';
import { fmtDate } from '@/lib/dateUtils';
import { Clock } from 'lucide-react';

const COLS: ColDef[] = [
  { key:'med_name', label:'ชื่อยา',
    render: r => <><p className="font-medium">{r.med_name}</p><p className="text-xs text-slate-400">{r.med_generic_name}</p></>,
    exportValue: r => r.med_name??'-' },
  { key:'patient_name', label:'ผู้ป่วย',
    render: r => <><p className="font-medium">{r.patient_name||'-'}</p><p className="text-xs text-slate-400">{r.hn_number}</p></>,
    exportValue: r => `${r.patient_name??'-'} (HN: ${r.hn_number??'-'})` },
  { key:'quantity', label:'จำนวน', className:'font-semibold' },
  { key:'doctor_name', label:'แพทย์', className:'text-xs' },
  { key:'dispense_status', label:'สถานะ',
    render: r => <Badge variant={r.dispense_status?'success':'warning'} dot>{r.dispense_status?'จ่ายแล้ว':'ค้างจ่าย'}</Badge>,
    exportValue: r => r.dispense_status ? 'จ่ายแล้ว' : 'ค้างจ่าย' },
  { key:'time', label:'วันที่',
    render: r => fmtDate(r.time),
    exportValue: r => fmtDate(r.time) },
];

export default function OverdueMedPage() {
  return (
    <MainLayout title="รายงานยาค้างจ่าย" subtitle="Overdue Medication Report">
      <DataTable cols={COLS}
        fetcher={p => extraReportApi.getOverdueMed(p).then((r:any) => ({ data:r.data.data??r.data, total:r.data.total??0 }))}
        filters={[{ key:'search', type:'search', placeholder:'ค้นหาชื่อยา, ผู้ป่วย...' }]}
        exportTitle="รายงานยาค้างจ่าย"
        emptyIcon={<Clock size={36}/>} emptyText="ไม่พบรายการ"
        deps={[]} />
    </MainLayout>
  );
}
