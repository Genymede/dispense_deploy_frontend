'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { extraReportApi } from '@/lib/api';
import RegistryDrawer from '@/components/RegistryDrawer';
import { BookOpen } from 'lucide-react';

const COLS: ColDef[] = [
  { key:'med_name', label:'ชื่อยา',
    render: r => <><p className="font-medium">{r.med_name}</p><p className="text-xs text-slate-400">{r.med_thai_name}</p></>,
    exportValue: r => r.med_name??'-' },
  { key:'med_marketing_name', label:'ชื่อการค้า', className:'text-xs text-slate-600',
    exportValue: r => r.med_marketing_name??'-' },
  { key:'med_generic_name', label:'ชื่อสามัญ', className:'text-xs text-slate-600' },
  { key:'med_medical_category', label:'หมวด', className:'text-xs' },
  { key:'med_dosage_form', label:'รูปแบบ', className:'text-xs' },
  { key:'med_counting_unit', label:'หน่วย', className:'text-xs' },
  { key:'med_selling_price', label:'ราคา',
    render: r => r.med_selling_price ? <span className="font-semibold text-primary-700">฿{Number(r.med_selling_price).toFixed(2)}</span> : '-',
    exportValue: r => r.med_selling_price ? `฿${Number(r.med_selling_price).toFixed(2)}` : '-' },
];

export default function MedTablePage() {
  const [drawer, setDrawer] = useState<any|null>(null);
  return (
    <MainLayout title="ทะเบียนยา" subtitle="Drug Master Table Report">
      <DataTable cols={COLS}
        fetcher={p => extraReportApi.getMedTable(p).then((r:any) => ({ data:r.data.data??r.data, total:r.data.total??0 }))}
        filters={[{ key:'search', type:'search', placeholder:'ค้นหาชื่อยา, ชื่อสามัญ...' }]}
        exportTitle="ทะเบียนยา"
        emptyIcon={<BookOpen size={36}/>} emptyText="ไม่พบรายการ"
        deps={[]} onRowClick={row => setDrawer(row)} />
      <RegistryDrawer open={!!drawer} onClose={() => setDrawer(null)} row={drawer}
        title={r => r.med_name} subtitle={r => r.med_generic_name}
        fields={[
          { label:'ชื่อยา',       key:'med_name' },
          { label:'ชื่อสามัญ',    key:'med_generic_name' },
          { label:'ชื่อการค้า',   key:'med_marketing_name' },
          { label:'ชื่อไทย',      key:'med_thai_name' },
          { label:'หมวดหมู่',     key:'med_medical_category' },
          { label:'รูปแบบ',       key:'med_dosage_form' },
          { label:'หน่วย',        key:'med_counting_unit' },
          { label:'ระดับยา',      key:'med_severity' },
          { label:'ราคาต้นทุน',   key:'med_cost_price',    type:'number' as const },
          { label:'ราคาขาย',      key:'med_selling_price', type:'number' as const },
          { label:'บัญชียาหลัก',  key:'med_essential_med_list' },
          { label:'Pregnancy Cat', key:'med_pregnancy_category' },
          { label:'TMT Code',      key:'med_TMT_code' },
        ]} />
    </MainLayout>
  );
}
