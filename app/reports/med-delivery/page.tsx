'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { Badge } from '@/components/ui';
import { extraReportApi } from '@/lib/api';
import { fmtDate } from '@/lib/dateUtils';
import RegistryDrawer from '@/components/RegistryDrawer';
import { DrawerSection } from '@/components/DetailDrawer';
import { Truck } from 'lucide-react';

const COLS: ColDef[] = [
  { key:'patient_name', label:'ผู้ป่วย',
    render: r => <><p className="font-medium">{r.patient_name}</p><p className="text-xs text-slate-400">{r.hn_number}</p></>,
    exportValue: r => `${r.patient_name??'-'} (HN: ${r.hn_number??'-'})` },
  { key:'receiver_name', label:'ผู้รับ', className:'text-sm' },
  { key:'receiver_phone', label:'โทร', className:'text-xs font-mono' },
  { key:'delivery_method', label:'วิธีส่ง', className:'text-xs' },
  { key:'status', label:'สถานะ',
    render: r => <Badge variant={r.status==='Delivered'?'success':r.status==='Cancelled'?'danger':'warning'}>{r.status}</Badge>,
    exportValue: r => r.status??'-' },
  { key:'delivery_date', label:'วันที่',
    render: r => fmtDate(r.delivery_date),
    exportValue: r => fmtDate(r.delivery_date) },
];

export default function MedDeliveryPage() {
  const [drawer, setDrawer] = useState<any|null>(null);
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
        deps={[]} onRowClick={row => setDrawer(row)} />
      <RegistryDrawer open={!!drawer} onClose={() => setDrawer(null)} row={drawer}
        title="การจัดส่งยา" subtitle={r => r.patient_name}
        fields={[
          { label:'ผู้ป่วย',     key:'_patient', type:'patient' as const },
          { label:'วิธีจัดส่ง', key:'delivery_method' },
          { label:'ผู้รับ',      key:'receiver_name' },
          { label:'เบอร์โทร',   key:'receiver_phone' },
          { label:'สถานะ',      key:'status' },
          { label:'วันที่',     key:'delivery_date', type:'date' as const },
          { label:'ที่อยู่',    key:'address', span:true },
          { label:'หมายเหตุ',  key:'note',    span:true },
        ]}
      >
        {row => {
          const list = Array.isArray(row.medicine_list) ? row.medicine_list : [];
          if (!list.length) return null;
          return (
            <DrawerSection title={`รายการยา (${list.length} รายการ)`}>
              <div className="space-y-2">
                {list.map((m: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                    <span className="text-sm text-slate-700">{m.med_showname || m.med_name}</span>
                    <span className="text-sm font-medium text-slate-600 shrink-0 ml-3">{m.quantity} {m.unit}</span>
                  </div>
                ))}
              </div>
            </DrawerSection>
          );
        }}
      </RegistryDrawer>
    </MainLayout>
  );
}
