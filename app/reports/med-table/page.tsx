'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import DetailDrawer, { DrawerSection, DrawerGrid } from '@/components/DetailDrawer';
import { Badge, Spinner } from '@/components/ui';
import { registryApi, extraReportApi } from '@/lib/api';
import { BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtDate } from '@/lib/dateUtils';

const PREG_TH: Record<string, string> = { A: 'A — ปลอดภัย', B: 'B — ค่อนข้างปลอดภัย', C: 'C — ระวัง', D: 'D — มีความเสี่ยง', X: 'X — ห้ามใช้' };

const COLS: ColDef[] = [
  { key: 'med_name', label: 'ชื่อยา',
    render: r => <><p className="font-medium text-slate-800">{r.med_name}</p><p className="text-xs text-slate-400">{r.med_thai_name}</p></>,
    exportValue: r => r.med_name ?? '-' },
  { key: 'med_marketing_name', label: 'ชื่อการค้า', className: 'text-xs text-slate-600',
    exportValue: r => r.med_marketing_name ?? '-' },
  { key: 'med_generic_name', label: 'ชื่อสามัญ', className: 'text-xs text-slate-600',
    exportValue: r => r.med_generic_name ?? '-' },
  { key: 'med_medical_category', label: 'หมวดหมู่', className: 'text-xs text-slate-500',
    exportValue: r => r.med_medical_category ?? '-' },
  { key: 'med_dosage_form', label: 'รูปแบบ', className: 'text-xs text-slate-500',
    exportValue: r => r.med_dosage_form ?? '-' },
  { key: 'med_counting_unit', label: 'หน่วย', className: 'text-xs',
    exportValue: r => r.med_counting_unit ?? '-' },
  { key: 'med_severity', label: 'ระดับ',
    render: r => <Badge variant={r.med_severity?.includes('เสพติด') ? 'danger' : r.med_severity?.includes('อันตราย') ? 'warning' : 'gray'} className="text-[10px]">{r.med_severity || '—'}</Badge>,
    exportValue: r => r.med_severity ?? '-' },
  { key: 'med_indication', label: 'ข้อบ่งใช้', className: 'text-xs text-slate-500',
    render: r => <span className="truncate block max-w-[200px]" title={r.med_indication}>{r.med_indication || '—'}</span>,
    exportValue: r => r.med_indication ?? '-' },
  { key: 'med_pregnancy_category', label: 'หมวดตั้งครรภ์',
    render: r => r.med_pregnancy_category
      ? <Badge variant={r.med_pregnancy_category === 'X' ? 'danger' : r.med_pregnancy_category === 'D' ? 'warning' : 'gray'} className="text-[10px]">{r.med_pregnancy_category}</Badge>
      : <span className="text-slate-300 text-xs">—</span>,
    exportValue: r => r.med_pregnancy_category ? (PREG_TH[r.med_pregnancy_category] ?? r.med_pregnancy_category) : '-' },
];

export default function MedTablePage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerData, setDrawerData] = useState<any>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const openView = async (med_id: number) => {
    setDrawerOpen(true);
    setDrawerData(null);
    setDrawerLoading(true);
    try { const r = await registryApi.getDrugById(med_id); setDrawerData(r.data); }
    catch (e: any) { toast.error(e.message); }
    finally { setDrawerLoading(false); }
  };

  const med = drawerData?.med;

  return (
    <MainLayout title="รายงานทะเบียนยาหลัก" subtitle="Drug Master Table Report">
      <DataTable cols={COLS}
        fetcher={p => extraReportApi.getMedTable(p).then((r: any) => ({ data: r.data.data ?? r.data, total: r.data.total ?? 0 }))}
        filters={[{ key: 'search', type: 'search', placeholder: 'ค้นหาชื่อยา, ชื่อสามัญ...' }]}
        exportTitle="รายงานทะเบียนยาหลัก"
        emptyIcon={<BookOpen size={36} />} emptyText="ไม่พบรายการ"
        deps={[]} onRowClick={row => openView(row.med_id)} />

      <DetailDrawer
        open={drawerOpen} onClose={() => { setDrawerOpen(false); setDrawerData(null); }}
        title={med?.med_name ?? 'รายละเอียดยา'}
        subtitle={med?.med_generic_name ?? ''}
        width="lg"
      >
        {drawerLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : med ? (
          <>
            <DrawerSection title="ข้อมูลยา">
              <DrawerGrid items={[
                { label: 'ชื่อยา', value: <p className="font-semibold">{med.med_name}</p> },
                { label: 'ชื่อสามัญ', value: med.med_generic_name || '—' },
                { label: 'ชื่อการค้า', value: med.med_marketing_name || '—' },
                { label: 'ชื่อภาษาไทย', value: med.med_thai_name || '—' },
                { label: 'หมวดหมู่', value: med.med_medical_category || '—' },
                { label: 'ข้อบ่งใช้', value: med.med_indication || '—' },
                { label: 'รูปแบบ', value: med.med_dosage_form || '—' },
                { label: 'หน่วยนับ', value: med.med_counting_unit || '—' },
                { label: 'ระดับยา', value: <Badge variant={med.med_severity?.includes('เสพติด') ? 'danger' : med.med_severity?.includes('อันตราย') ? 'warning' : 'gray'}>{med.med_severity || '—'}</Badge> },
                { label: 'บัญชียาหลัก', value: med.med_essential_med_list === 'Y' ? <Badge variant="success">ใช่</Badge> : 'ไม่ใช่' },
                { label: 'หมวดตั้งครรภ์', value: med.med_pregnancy_category ? (PREG_TH[med.med_pregnancy_category] ?? med.med_pregnancy_category) : '—' },
                { label: 'TMT Code', value: <span className="font-mono text-xs">{med.med_TMT_code || '—'}</span> },
                { label: 'TPU Code', value: <span className="font-mono text-xs">{med.med_TPU_code || '—'}</span> },
              ]} />
            </DrawerSection>

            {drawerData.subwarehouse?.length > 0 && (
              <DrawerSection title={`สต็อกในคลัง (${drawerData.subwarehouse.length} รายการ)`}>
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        {['ชื่อคลัง/รูปแบบ', 'สต็อก', 'ขั้นต่ำ', 'ที่เก็บ', 'หมดอายุ'].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {drawerData.subwarehouse.map((s: any) => (
                        <tr key={s.med_sid} className="hover:bg-slate-50">
                          <td className="px-3 py-2">
                            <p className="font-medium">{s.med_showname || s.packaging_type || '—'}</p>
                            {s.packaging_type && s.med_showname && <p className="text-slate-400">{s.packaging_type}</p>}
                          </td>
                          <td className="px-3 py-2 font-semibold">{s.med_quantity}</td>
                          <td className="px-3 py-2">{s.min_quantity ?? '—'}</td>
                          <td className="px-3 py-2 font-mono">{s.location || '—'}</td>
                          <td className="px-3 py-2">{fmtDate(s.exp_date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DrawerSection>
            )}

            {drawerData.interactions?.length > 0 && (
              <DrawerSection title={`ปฏิกิริยากับยาอื่น (${drawerData.interactions.length})`}>
                <div className="space-y-1.5">
                  {drawerData.interactions.map((i: any) => (
                    <div key={i.interaction_id}
                      className={`px-3 py-2.5 rounded-xl border text-xs ${i.interaction_type === 'incompatible' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
                      <p className="font-semibold text-slate-800">{i.interacts_with_name}</p>
                      {i.description && <p className="text-slate-500 mt-0.5">{i.description}</p>}
                    </div>
                  ))}
                </div>
              </DrawerSection>
            )}
          </>
        ) : null}
      </DetailDrawer>
    </MainLayout>
  );
}
