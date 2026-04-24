'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { Badge } from '@/components/ui';
import { extraReportApi } from '@/lib/api';
import { thaiToday, thaiDaysAgo, fmtDate } from '@/lib/dateUtils';
import RegistryDrawer from '@/components/RegistryDrawer';
import { FileText } from 'lucide-react';

const COLS: ColDef[] = [
  { key:'med_name', label:'ชื่อยา',
    render: r => <><p className="font-medium">{r.med_name}</p><p className="text-xs text-slate-400">{r.category}</p></>,
    exportValue: r => r.med_name??'-' },
  { key:'quantity', label:'จำนวน',
    render: r => <span className="font-semibold">{r.quantity} {r.med_counting_unit||''}</span>,
    exportValue: r => `${r.quantity} ${r.med_counting_unit||''}` },
  { key:'current_stock', label:'สต็อก',
    render: r => <span className={Number(r.current_stock)<10?'text-red-600 font-bold':''}>{r.current_stock??'-'}</span>,
    exportValue: r => String(r.current_stock??'-') },
  { key:'requested_by_name', label:'ผู้ขอ', className:'text-xs' },
  { key:'approved_by_name',  label:'ผู้อนุมัติ', className:'text-xs text-slate-500' },
  { key:'status', label:'สถานะ',
    render: r => <Badge variant={r.status==='approved'?'success':r.status==='pending'?'warning':r.status==='rejected'?'danger':'gray'}>{r.status}</Badge>,
    exportValue: r => r.status??'-' },
  { key:'request_time', label:'วันที่',
    render: r => fmtDate(r.request_time),
    exportValue: r => fmtDate(r.request_time) },
];

export default function RadRegistryPage() {
  const [drawer, setDrawer] = useState<any|null>(null);
  return (
    <MainLayout title="RAD Registry" subtitle="Medication Request Summary">
      <DataTable cols={COLS}
        fetcher={p => extraReportApi.getRadRegistry(p).then((r:any) => ({ data:r.data.data??r.data, total:r.data.total??0 }))}
        filters={[
          { key:'date_from', type:'date', placeholder:'จากวันที่', defaultValue: thaiDaysAgo(30) },
          { key:'date_to',   type:'date', placeholder:'ถึงวันที่',  defaultValue: thaiToday() },
          { key:'status', type:'select', placeholder:'ทุกสถานะ',
            options:[{value:'pending',label:'รอ'},{value:'approved',label:'อนุมัติ'},{value:'rejected',label:'ปฏิเสธ'},{value:'dispensed',label:'จ่ายแล้ว'},{value:'cancelled',label:'ยกเลิก'}] },
        ]}
        exportTitle="RAD Registry"
        emptyIcon={<FileText size={36}/>} emptyText="ไม่พบรายการ"
        deps={[]} onRowClick={row => setDrawer(row)} />
      <RegistryDrawer open={!!drawer} onClose={() => setDrawer(null)} row={drawer}
        title={r => r.med_name} subtitle={r => r.requested_by_name}
        fields={[
          { label:'ชื่อยา',     key:'med_name' },
          { label:'จำนวน',      key:'quantity', type:'template' as const, template: r => `${r.quantity} ${r.med_counting_unit||''}` },
          { label:'สต็อก',      key:'current_stock', type:'number' as const },
          { label:'ที่เก็บ',    key:'location' },
          { label:'ผู้ขอ',      key:'requested_by_name' },
          { label:'ผู้อนุมัติ', key:'approved_by_name' },
          { label:'สถานะ',      key:'status' },
          { label:'วันที่ขอ',   key:'request_time', type:'datetime' as const },
          { label:'หมายเหตุ',   key:'note', span:true },
        ]} />
    </MainLayout>
  );
}
