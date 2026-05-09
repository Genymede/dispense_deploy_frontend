'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { CrudModal, RowActions } from '@/components/CrudModal';
import { Select, Textarea, Badge } from '@/components/ui';
import SearchSelect from '@/components/SearchSelect';
import RegistryDrawer from '@/components/RegistryDrawer';
import { registryApi, crudApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Repeat2 } from 'lucide-react';
import toast from 'react-hot-toast';

const IT: Record<string, { label: string; variant: 'danger'|'success'|'gray'|'warning' }> = {
  incompatible: { label: 'ห้ามใช้ร่วม', variant: 'danger' },
  compatible:   { label: 'ใช้ร่วมได้',  variant: 'success' },
  neutral:      { label: 'เป็นกลาง',    variant: 'gray' },
  unknown:      { label: 'ไม่ทราบ',     variant: 'warning' },
};

const emptyForm = {
  med_id_1: 0, drug1_label: '', med_id_2: 0, drug2_label: '',
  description: '', severity: '', evidence_level: '', source_reference: '', interaction_type: 'unknown',
  recorded_by_id: null as string | null, recorded_by_label: '',
};

const TextInput = ({ label, value, onChange, placeholder }: any) => (
  <div>
    <label className="text-xs font-medium text-slate-700 block mb-1.5">{label}</label>
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full h-9 border border-slate-200 rounded-lg text-sm px-3 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
  </div>
);

const cols: ColDef[] = [
  { key: 'drug1_name', label: 'ยา 1',
    render: r => <><p className="font-medium">{r.drug1_name}</p><p className="text-xs text-slate-400">{r.drug1_generic}</p></> },
  { key: 'drug2_name', label: 'ยา 2',
    render: r => <><p className="font-medium">{r.drug2_name}</p><p className="text-xs text-slate-400">{r.drug2_generic}</p></> },
  { key: 'interaction_type', label: 'ประเภท',
    render: r => { const c = IT[r.interaction_type] ?? { label: r.interaction_type, variant: 'gray' as const }; return <Badge variant={c.variant}>{c.label}</Badge>; } },
  { key: 'severity', label: 'ระดับ',
    render: r => <Badge variant={r.severity === 'severe' ? 'danger' : r.severity ? 'warning' : 'gray'}>{r.severity || '-'}</Badge> },
  { key: 'description',    label: 'คำอธิบาย',  className: 'text-xs max-w-[260px] truncate' },
  { key: 'evidence_level',   label: 'หลักฐาน',  className: 'text-xs text-slate-400' },
  { key: 'recorded_by_name', label: 'ผู้บันทึก', className: 'text-xs text-slate-500' },
];

export default function MedInteractionsPage() {
  const { user } = useAuth();
  const [form,      setForm]      = useState<typeof emptyForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [reload,    setReload]    = useState(0);
  const [resetKey,  setResetKey]  = useState(0);
  const [drawer,    setDrawer]    = useState<any | null>(null);
  const [errors,    setErrors]    = useState<Record<string,string>>({});
  const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  const clearErr = (k: string) => { if (errors[k]) setErrors(p => ({ ...p, [k]: '' })); };

  const openAdd = () => {
    setForm({ ...emptyForm, recorded_by_id: user?.id ?? null, recorded_by_label: user?.email ?? '' });
    setEditingId(null); setResetKey(k=>k+1); setErrors({}); setShowModal(true);
  };
  const openEdit = (row: any) => {
    setForm({ med_id_1: row.med_id_1, drug1_label: row.drug1_name||'',
      med_id_2: row.med_id_2, drug2_label: row.drug2_name||'',
      description: row.description||'', severity: row.severity||'',
      evidence_level: row.evidence_level||'', source_reference: row.source_reference||'',
      interaction_type: row.interaction_type||'unknown',
      recorded_by_id: row.recorded_by ?? null, recorded_by_label: row.recorded_by_name ?? '' });
    setEditingId(row.interaction_id); setResetKey(k=>k+1); setErrors({}); setShowModal(true);
  };

  const handleSave = async () => {
    const errs: Record<string,string> = {};
    if (!form.med_id_1) errs.med_id_1 = 'กรุณาเลือกยาตัวที่ 1';
    if (!form.med_id_2) errs.med_id_2 = 'กรุณาเลือกยาตัวที่ 2';
    if (form.med_id_1 && form.med_id_2 && form.med_id_1 === form.med_id_2) errs.med_id_2 = 'ต้องเป็นยาคนละชนิด';
    if (!form.description.trim()) errs.description = 'กรุณากรอกคำอธิบาย';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const payload = { med_id_1: form.med_id_1, med_id_2: form.med_id_2,
        description: form.description, severity: form.severity,
        evidence_level: form.evidence_level, source_reference: form.source_reference,
        interaction_type: form.interaction_type,
        recorded_by: form.recorded_by_id || user?.id || null };
      if (editingId) { await crudApi.updateInteraction(editingId, payload); toast.success('แก้ไขแล้ว'); }
      else           { await crudApi.createInteraction(payload);            toast.success('เพิ่มแล้ว'); }
      setShowModal(false); setReload(r=>r+1);
    } catch (e: any) {
      if (!editingId && e.message?.includes('มีอยู่แล้ว')) setErrors({ med_id_2: e.message });
      else toast.error(e.message);
    }
    finally { setSaving(false); }
  };

  return (
    <MainLayout title="ทะเบียนปฏิกิริยายา" subtitle="Drug Interaction Registry"
>
      <DataTable cols={cols}
        fetcher={p => registryApi.getInteractions(p).then(r => r.data)}
        searchPlaceholder="ค้นหาชื่อยา..."
        emptyIcon={<Repeat2 size={36} />} emptyText="ไม่พบรายการ"
        deps={[reload]} onAdd={openAdd} addLabel="เพิ่มปฏิกิริยา"
        onRowClick={row => setDrawer(row)}
        actionCol={row => (
          <RowActions onView={() => setDrawer(row)} onEdit={() => openEdit(row)}
            onDelete={async () => { await crudApi.deleteInteraction(row.interaction_id); setReload(r=>r+1); }} />
        )}
        deleteConfirmText={row => `ลบปฏิกิริยา ${row.drug1_name} + ${row.drug2_name}?`}
      />

      <CrudModal open={showModal} onClose={() => setShowModal(false)}
        title="ปฏิกิริยาระหว่างยา" editingId={editingId} onSave={handleSave} saving={saving}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <SearchSelect type="drug" label="ยา 1" required initialDisplay={form.drug1_label} resetKey={resetKey}
              onSelect={d => { f('med_id_1', d?.med_id??0); f('drug1_label', d?.med_name??''); clearErr('med_id_1'); }} disabled={!!editingId} />
            {errors.med_id_1 && <p className="mt-1 text-xs text-red-500">{errors.med_id_1}</p>}
          </div>
          <div>
            <SearchSelect type="drug" label="ยา 2" required initialDisplay={form.drug2_label} resetKey={resetKey}
              onSelect={d => { f('med_id_2', d?.med_id??0); f('drug2_label', d?.med_name??''); clearErr('med_id_2'); }} disabled={!!editingId} />
            {errors.med_id_2 && <p className="mt-1 text-xs text-red-500">{errors.med_id_2}</p>}
          </div>
          <Select label="ประเภท" value={form.interaction_type} onChange={e => f('interaction_type', e.target.value)}
            options={Object.entries(IT).map(([v,{label}]) => ({value:v,label}))} />
          <Select label="ระดับ" value={form.severity} onChange={e => f('severity', e.target.value)}
            placeholder="เลือก" options={['mild','moderate','severe'].map(s=>({value:s,label:s}))} />
          <div className="col-span-2">
            <Textarea label="คำอธิบาย" required value={form.description}
              onChange={e => { f('description', e.target.value); clearErr('description'); }} rows={3}
              error={errors.description} />
          </div>
          <TextInput label="ระดับหลักฐาน" value={form.evidence_level} onChange={(v: string) => f('evidence_level', v)} placeholder="Level A, RCT..." />
          <TextInput label="แหล่งอ้างอิง" value={form.source_reference} onChange={(v: string) => f('source_reference', v)} placeholder="Lexicomp, Medscape..." />
          <div className="col-span-2">
            <SearchSelect type="user" label="ผู้บันทึกข้อมูล"
              initialDisplay={form.recorded_by_label} resetKey={resetKey}
              onSelect={u => { f('recorded_by_id', u?.id ?? null); f('recorded_by_label', u?.full_name ?? ''); }} />
          </div>
        </div>
      </CrudModal>

      <RegistryDrawer
        open={!!drawer} onClose={() => setDrawer(null)} row={drawer}
        title={r => `${r.drug1_name} + ${r.drug2_name}`}
        subtitle={r => IT[r.interaction_type]?.label ?? r.interaction_type}
        onEdit={openEdit}
        fields={[
          { label: 'ยา 1',         key: 'drug1_name' },
          { label: 'ยา 2',         key: 'drug2_name' },
          { label: 'ประเภท',       key: 'interaction_type', type: 'template',
            template: r => IT[r.interaction_type]?.label ?? r.interaction_type },
          { label: 'ระดับ',        key: 'severity' },
          { label: 'คำอธิบาย',    key: 'description', span: true },
          { label: 'หลักฐาน',     key: 'evidence_level' },
          { label: 'อ้างอิง',     key: 'source_reference' },
          { label: 'ผู้บันทึก',   key: 'recorded_by_name' },
        ]}
      />
    </MainLayout>
  );
}
