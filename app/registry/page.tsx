'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { CrudModal, FormGrid, FormSpan, RowActions } from '@/components/CrudModal';
import DetailDrawer, { DrawerSection, DrawerGrid } from '@/components/DetailDrawer';
import { Input, Select, Textarea, Badge, Spinner } from '@/components/ui';
import { registryApi, crudApi, type MedRegistryItem } from '@/lib/api';
import { BookOpen, Database } from 'lucide-react';
import toast from 'react-hot-toast';
import { thaiToday, thaiDaysAgo, fmtDate } from '@/lib/dateUtils';

const CATEGORIES = ['ยาปฏิชีวนะ','ยาแก้ปวด','ยาลดความดัน','ยาเบาหวาน','ยาหัวใจ','ยาระบบทางเดินอาหาร','วิตามิน','อื่นๆ'];
const SEVERITIES = ['ยาทั่วไป','ยาอันตราย','ยาควบคุมพิเศษ','ยาเสพติดให้โทษ','วัตถุออกฤทธิ์'];
const UNITS = ['เม็ด','แคปซูล','ขวด','ซอง','หลอด','มล.','กรัม','ชิ้น'];
const PREG = ['A','B','C','D','X'];
const PREG_TH: Record<string,string> = { A:'A — ปลอดภัย', B:'B — ค่อนข้างปลอดภัย', C:'C — ระวัง', D:'D — มีความเสี่ยง', X:'X — ห้ามใช้' };

const empty = {
  med_name:'', med_generic_name:'', med_severity:'ยาทั่วไป', med_counting_unit:'เม็ด',
  med_marketing_name:'', med_thai_name:'', med_cost_price:'', med_selling_price:'',
  med_medium_price:'', med_dosage_form:'', med_medical_category:'',
  med_essential_med_list:'', med_pregnancy_category:'',
  med_TMT_code:'', med_TPU_code:'', med_out_of_stock: false,
  med_mfg:'', med_exp:'',
};

const cols: ColDef[] = [
  { key: 'med_id', label: 'ID', width: '60px', render: r => <span className="font-mono text-xs text-slate-400">{r.med_id}</span> },
  { key: 'med_name', label: 'ชื่อยา', render: r => (<><p className="font-medium text-slate-800">{r.med_name}</p><p className="text-xs text-slate-400">{r.med_thai_name}</p></>) },
  { key: 'med_marketing_name', label: 'ชื่อการค้า', className: 'text-xs text-slate-600' },
  { key: 'med_generic_name', label: 'ชื่อสามัญ', className: 'text-xs text-slate-600' },
  { key: 'med_medical_category', label: 'หมวดหมู่', className: 'text-xs text-slate-500' },
  { key: 'med_dosage_form', label: 'รูปแบบ', className: 'text-xs text-slate-500' },
  { key: 'med_counting_unit', label: 'หน่วย', className: 'text-xs' },
  { key: 'med_severity', label: 'ระดับ', render: r => <Badge variant={r.med_severity?.includes('เสพติด') ? 'danger' : r.med_severity?.includes('อันตราย') ? 'warning' : 'gray'} className="text-[10px]">{r.med_severity}</Badge> },
  { key: 'med_essential_med_list', label: 'ยาหลัก', render: r => r.med_essential_med_list === 'Y' ? <Badge variant="success">ใช่</Badge> : <span className="text-slate-300 text-xs">-</span> },
  { key: 'med_selling_price', label: 'ราคาขาย', render: r => <span className="font-semibold text-primary-700 text-xs">฿{Number(r.med_selling_price||0).toFixed(2)}</span> },
  { key: 'med_exp', label: 'หมดอายุ', render: r => fmtDate(r.med_exp) },
];

export default function RegistryPage() {
  const [form, setForm] = useState<any>(empty);
  const [editingId, setEditingId] = useState<number|null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);

  // Detail drawer
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [drawerData,    setDrawerData]    = useState<any>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const openView = async (med_id: number) => {
    setDrawerOpen(true);
    setDrawerData(null);
    setDrawerLoading(true);
    try { const r = await registryApi.getDrugById(med_id); setDrawerData(r.data); }
    catch (e: any) { toast.error(e.message); }
    finally { setDrawerLoading(false); }
  };

  const openCreate = () => { setForm(empty); setEditingId(null); setShowModal(true); };
  const openEdit = (row: MedRegistryItem) => {
    setForm({
      med_name: row.med_name, med_generic_name: row.med_generic_name||'',
      med_severity: row.med_severity, med_counting_unit: row.med_counting_unit,
      med_marketing_name: row.med_marketing_name, med_thai_name: row.med_thai_name||'',
      med_cost_price: String(row.med_cost_price||''), med_selling_price: String(row.med_selling_price||''),
      med_medium_price: String(row.med_medium_price||''), med_dosage_form: row.med_dosage_form||'',
      med_medical_category: row.med_medical_category||'', med_essential_med_list: row.med_essential_med_list||'',
      med_pregnancy_category: row.med_pregnancy_category||'',
      med_TMT_code: row.med_TMT_code||'', med_TPU_code: row.med_TPU_code||'',
      med_out_of_stock: row.med_out_of_stock,
      med_mfg: row.med_mfg ? row.med_mfg.slice(0,10) : '',
      med_exp: row.med_exp ? row.med_exp.slice(0,10) : '',
    });
    setEditingId(row.med_id);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.med_name || !form.med_counting_unit || !form.med_marketing_name) {
      toast.error('กรุณากรอกชื่อยา, หน่วย, ชื่อการค้า'); return;
    }
    setSaving(true);
    try {
      const payload = { ...form,
        med_cost_price: Number(form.med_cost_price||0),
        med_selling_price: Number(form.med_selling_price||0),
        med_medium_price: Number(form.med_medium_price||0),
        med_mfg: form.med_mfg || thaiToday(),
        med_exp: form.med_exp || thaiDaysAgo(-365),
      };
      if (editingId) { await crudApi.updateMedTable(editingId, payload); toast.success('แก้ไขเรียบร้อย'); }
      else { await crudApi.createMedTable(payload); toast.success('เพิ่มยาใหม่เรียบร้อย'); }
      setShowModal(false); setReload(r => r + 1);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (row: MedRegistryItem) => {
    await crudApi.deleteMedTable(row.med_id);
    setReload(r => r + 1);
  };

  const f = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const med = drawerData?.med;

  return (
    <MainLayout title="ทะเบียนยาหลัก" subtitle="Med Table Registry"
>
      <DataTable
        cols={cols}
        fetcher={p => registryApi.getDrugs(p).then(r => r.data)}
        searchPlaceholder="ค้นหาชื่อยา, ชื่อสามัญ, TMT Code..."
        emptyIcon={<Database size={36} />} emptyText="ไม่พบรายการยา"
        deps={[reload]}
        onRowClick={row => openView(row.med_id)}
        onAdd={openCreate} addLabel="เพิ่มยาใหม่"
        actionCol={row => (
          <RowActions
            onView={() => openView(row.med_id)}
            onEdit={() => openEdit(row)}
            onDelete={() => handleDelete(row)}
          />
        )}
        deleteConfirmText={r => `ลบ "${r.med_name}" ออกจากทะเบียน?`}
      />

      {/* Create/Edit Modal */}
      <CrudModal open={showModal} onClose={() => setShowModal(false)}
        title="ทะเบียนยา" editingId={editingId} onSave={handleSave} saving={saving} size="xl">
        <FormGrid cols={2}>
          <FormSpan><Input label="ชื่อยา (Trade name)" required value={form.med_name} onChange={e => f('med_name', e.target.value)} /></FormSpan>
          <Input label="ชื่อสามัญ (Generic name)" value={form.med_generic_name} onChange={e => f('med_generic_name', e.target.value)} />
          <Input label="ชื่อการค้า" required value={form.med_marketing_name} onChange={e => f('med_marketing_name', e.target.value)} />
          <Input label="ชื่อภาษาไทย" value={form.med_thai_name} onChange={e => f('med_thai_name', e.target.value)} />
          <Select label="หมวดหมู่" value={form.med_medical_category} onChange={e => f('med_medical_category', e.target.value)}
            options={CATEGORIES.map(c => ({ value: c, label: c }))} placeholder="เลือกหมวดหมู่" />
          <Select label="รูปแบบยา" value={form.med_dosage_form} onChange={e => f('med_dosage_form', e.target.value)}
            options={['Tablet','Capsule','Syrup','Injection','Cream','Ointment','Inhaler','Powder','Solution','Suppository'].map(d => ({ value: d, label: d }))} placeholder="เลือกรูปแบบ" />
          <Select label="หน่วยนับ" required value={form.med_counting_unit} onChange={e => f('med_counting_unit', e.target.value)}
            options={UNITS.map(u => ({ value: u, label: u }))} />
          <Select label="ระดับยา" value={form.med_severity} onChange={e => f('med_severity', e.target.value)}
            options={SEVERITIES.map(s => ({ value: s, label: s }))} />
          <Input label="ราคาต้นทุน (บาท)" type="number" step="0.01" value={form.med_cost_price} onChange={e => f('med_cost_price', e.target.value)} />
          <Input label="ราคาขาย (บาท)" type="number" step="0.01" value={form.med_selling_price} onChange={e => f('med_selling_price', e.target.value)} />
          <Select label="บัญชียาหลัก" value={form.med_essential_med_list} onChange={e => f('med_essential_med_list', e.target.value)}
            options={[{ value: 'Y', label: 'ใช่' }, { value: 'N', label: 'ไม่ใช่' }]} placeholder="เลือก" />
          <Select label="หมวดการตั้งครรภ์" value={form.med_pregnancy_category} onChange={e => f('med_pregnancy_category', e.target.value)}
            options={PREG.map(p => ({ value: p, label: PREG_TH[p] }))} placeholder="เลือก" />
          <Input label="TMT Code" value={form.med_TMT_code} onChange={e => f('med_TMT_code', e.target.value)} />
          <Input label="TPU Code" value={form.med_TPU_code} onChange={e => f('med_TPU_code', e.target.value)} />
          <Input label="วันผลิต (ทะเบียน)" type="date" value={form.med_mfg} onChange={e => f('med_mfg', e.target.value)} />
          <Input label="วันหมดอายุ (ทะเบียน)" type="date" value={form.med_exp} onChange={e => f('med_exp', e.target.value)} />
          <div className="flex items-center gap-2 pt-1">
            <input type="checkbox" id="oos" checked={form.med_out_of_stock} onChange={e => f('med_out_of_stock', e.target.checked)} className="w-4 h-4" />
            <label htmlFor="oos" className="text-sm text-slate-700">หมดสต็อก (Out of Stock)</label>
          </div>
        </FormGrid>
      </CrudModal>

      {/* Detail Drawer */}
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
                { label: 'ชื่อยา',          value: <p className="font-semibold">{med.med_name}</p> },
                { label: 'ชื่อสามัญ',       value: med.med_generic_name || '—' },
                { label: 'ชื่อการค้า',      value: med.med_marketing_name || '—' },
                { label: 'ชื่อภาษาไทย',    value: med.med_thai_name || '—' },
                { label: 'หมวดหมู่',        value: med.med_medical_category || '—' },
                { label: 'รูปแบบ',          value: med.med_dosage_form || '—' },
                { label: 'หน่วยนับ',        value: med.med_counting_unit },
                { label: 'ระดับยา',         value: <Badge variant={med.med_severity?.includes('เสพติด') ? 'danger' : med.med_severity?.includes('อันตราย') ? 'warning' : 'gray'}>{med.med_severity || '—'}</Badge> },
                { label: 'บัญชียาหลัก',    value: med.med_essential_med_list === 'Y' ? <Badge variant="success">ใช่</Badge> : 'ไม่ใช่' },
                { label: 'หมวดตั้งครรภ์',  value: med.med_pregnancy_category ? `${PREG_TH[med.med_pregnancy_category] ?? med.med_pregnancy_category}` : '—' },
                { label: 'ราคาต้นทุน',     value: `฿${Number(med.med_cost_price||0).toFixed(2)}` },
                { label: 'ราคาขาย',        value: <span className="font-semibold text-primary-700">฿{Number(med.med_selling_price||0).toFixed(2)}</span> },
                { label: 'TMT Code',        value: <span className="font-mono text-xs">{med.med_TMT_code || '—'}</span> },
                { label: 'TPU Code',        value: <span className="font-mono text-xs">{med.med_TPU_code || '—'}</span> },
                { label: 'วันผลิต',         value: fmtDate(med.med_mfg) },
                { label: 'วันหมดอายุ',     value: fmtDate(med.med_exp) },
              ]} />
            </DrawerSection>

            {/* สต็อกในคลัง */}
            {drawerData.subwarehouse?.length > 0 && (
              <DrawerSection title={`สต็อกในคลัง (${drawerData.subwarehouse.length} รายการ)`}>
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        {['ชื่อคลัง/รูปแบบ','สต็อก','ขั้นต่ำ','ที่เก็บ','หมดอายุ'].map(h => (
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

            {/* ปฏิกิริยายา */}
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
