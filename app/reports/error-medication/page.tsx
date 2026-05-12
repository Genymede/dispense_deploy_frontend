'use client';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { extraReportApi } from '@/lib/api';
import { fmtDate } from '@/lib/dateUtils';
import { FileWarning } from 'lucide-react';

const COLS: ColDef[] = [
  { key:'time', label:'วันเวลา',
    render: r => fmtDate(r.time, true),
    exportValue: r => fmtDate(r.time, true) },
  { key:'patient_name', label:'ผู้ป่วย',
    render: r => r.patient_name ? <p className="font-medium">{r.patient_name}</p> : <span className="text-slate-400">-</span>,
    exportValue: r => r.patient_name??'-' },
  { key:'med_name', label:'ยา',
    render: r => r.med_name ? <p className="font-medium">{r.med_name}</p> : <span className="text-slate-400">-</span>,
    exportValue: r => r.med_name??'-' },
  { key:'doctor_name', label:'แพทย์', className:'text-xs text-slate-600' },
  { key:'description', label:'คำอธิบาย', className:'text-xs max-w-[200px] truncate' },
  { key:'recorded_by_name', label:'ผู้บันทึก', className:'text-xs text-slate-500',
    exportValue: r => r.recorded_by_name??'-' },
];

export default function ErrorMedicationPage() {
  return (
    <MainLayout title="Medication Error" subtitle="Medication Error Report">
      <DataTable cols={COLS}
        fetcher={p => extraReportApi.getErrorMedication(p).then((r:any) => ({ data:r.data.data??r.data, total:r.data.total??0 }))}
        filters={[
          { key:'search', type:'search', placeholder:'ค้นหาชื่อผู้ป่วย, ยา...' },
          { key:'date_from', type:'date', placeholder:'จากวันที่' },
          { key:'date_to',   type:'date', placeholder:'ถึงวันที่' },
        ]}
        exportTitle="Medication Error"
        emptyIcon={<FileWarning size={36}/>} emptyText="ไม่พบรายการ"
        deps={[]} />
    </MainLayout>
  );
}
