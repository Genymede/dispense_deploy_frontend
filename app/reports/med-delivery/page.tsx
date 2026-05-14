'use client';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { Badge } from '@/components/ui';
import { extraReportApi } from '@/lib/api';
import { fmtDate } from '@/lib/dateUtils';
import { Truck } from 'lucide-react';

const COLS: ColDef[] = [
  { key:'patient_name', label:'ผู้ป่วย',
    render: r => <><p className="font-medium">{r.patient_name}</p><p className="text-xs text-slate-400">{r.hn_number}</p></>,
    exportValue: r => `${r.patient_name??'-'} (HN: ${r.hn_number??'-'})` },
  { key:'delivery_method', label:'วิธีส่ง', className:'text-xs' },
  { key:'status', label:'สถานะ',
    render: r => <Badge variant={r.status==='Delivered'?'success':r.status==='Cancelled'?'danger':'warning'}>{r.status}</Badge>,
    exportValue: r => r.status??'-' },
  { key:'delivery_date', label:'วันที่',
    render: r => fmtDate(r.delivery_date),
    exportValue: r => fmtDate(r.delivery_date) },
];

export default function MedDeliveryPage() {
  return (
    <MainLayout title="รายงานการจัดส่งยา" subtitle="Medication Delivery Report">
      <DataTable cols={COLS}
        fetcher={p => extraReportApi.getMedDelivery(p).then((r:any) => ({ data:r.data.data??r.data, total:r.data.total??0 }))}
        filters={[
          { key:'search', type:'search', placeholder:'ค้นหาชื่อผู้ป่วย...' },
          { key:'status', type:'select', placeholder:'ทุกสถานะ',
            options:[{value:'Pending',label:'รอ'},{value:'Delivered',label:'ส่งแล้ว'},{value:'Cancelled',label:'ยกเลิก'}] },
          { key:'date_from', type:'date', placeholder:'จากวันที่' },
          { key:'date_to',   type:'date', placeholder:'ถึงวันที่' },
        ]}
        exportTitle="รายงานการจัดส่งยา"
        emptyIcon={<Truck size={36}/>} emptyText="ไม่พบรายการ"
        deps={[]} />
    </MainLayout>
  );
}
