'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { extraReportApi } from '@/lib/api';
import { fmtDate } from '@/lib/dateUtils';
import RegistryDrawer from '@/components/RegistryDrawer';
import { Database } from 'lucide-react';

const COLS: ColDef[] = [
  { key:'drug_name', label:'ชื่อยา',
    render: r => <><p className="font-medium">{r.drug_name}</p><p className="text-xs text-slate-400">{r.med_generic_name}</p></>,
    exportValue: r => r.drug_name??'-' },
  { key:'category', label:'หมวด', className:'text-xs' },
  { key:'packaging_type', label:'รูปแบบ', className:'text-xs' },
  { key:'med_quantity', label:'คงเหลือ',
    render: r => <span className={Number(r.med_quantity)<(r.min_quantity??0)?'text-red-600 font-bold':'font-semibold'}>{r.med_quantity}</span>,
    exportValue: r => String(r.med_quantity??'-') },
  { key:'min_quantity', label:'ขั้นต่ำ', className:'text-xs text-slate-500' },
  { key:'location', label:'ที่เก็บ', className:'text-xs font-mono' },
  { key:'exp_date', label:'หมดอายุ',
    render: r => fmtDate(r.exp_date),
    exportValue: r => fmtDate(r.exp_date) },
];

export default function MedSubwarehousePage() {
  const [drawer, setDrawer] = useState<any|null>(null);
  return (
    <MainLayout title="คลังยาย่อย" subtitle="Subwarehouse Inventory Report">
      <DataTable cols={COLS}
        fetcher={p => extraReportApi.getMedSubwarehouse(p).then((r:any) => ({ data:r.data.data??r.data, total:r.data.total??0 }))}
        filters={[
          { key:'search', type:'search', placeholder:'ค้นหาชื่อยา...' },
          { key:'status', type:'select', placeholder:'ทุกสถานะ',
            options:[{value:'low',label:'สต็อกต่ำ'},{value:'expired',label:'หมดอายุ'},{value:'out',label:'หมดสต็อก'}] },
        ]}
        exportTitle="คลังยาย่อย"
        emptyIcon={<Database size={36}/>} emptyText="ไม่พบรายการ"
        deps={[]} onRowClick={row => setDrawer(row)} />
      <RegistryDrawer open={!!drawer} onClose={() => setDrawer(null)} row={drawer}
        title={r => r.drug_name} subtitle={r => r.category}
        fields={[
          { label:'ชื่อยา',     key:'drug_name' },
          { label:'ชื่อสามัญ',  key:'med_generic_name' },
          { label:'หมวด',       key:'category' },
          { label:'รูปแบบ',     key:'packaging_type' },
          { label:'คงเหลือ',    key:'med_quantity', type:'number' as const },
          { label:'ขั้นต่ำ',    key:'min_quantity',  type:'number' as const },
          { label:'สูงสุด',     key:'max_quantity',  type:'number' as const },
          { label:'ที่เก็บ',    key:'location' },
          { label:'วันหมดอายุ', key:'exp_date', type:'date' as const },
          { label:'Lot',        key:'lot_number' },
          { label:'ราคา',       key:'cost_price', type:'number' as const },
        ]} />
    </MainLayout>
  );
}
