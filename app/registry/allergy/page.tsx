'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { CrudModal, FormGrid, RowActions } from '@/components/CrudModal';
import { Input, Select, Textarea, Badge, Button } from '@/components/ui';
import SearchSelect from '@/components/SearchSelect';
import DetailDrawer, { DrawerSection, DrawerGrid } from '@/components/DetailDrawer';
import { registryApi, crudApi } from '@/lib/api';
import { ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtDate } from '@/lib/dateUtils';

const SEV = {
  mild:     { label: 'เล็กน้อย', variant: 'gray'    as const },
  moderate: { label: 'ปานกลาง', variant: 'warning' as const },
  severe:   { label: 'รุนแรง',   variant: 'danger'  as const },
};

const emptyForm = {
  patient_id: 0, patient_label: '',
  med_id: 0,     med_label: '',
  symptoms: '', description: '', severity: 'mild', reported_at: '',
};

const cols: ColDef[] = [
  { key: 'patient_name', label: 'ผู้ป่วย',
    render: r => <><p className="font-medium">{r.patient_name}</p><p className="text-xs text-slate-400">{r.hn_number}</p></> },
  { key: 'med_name', label: 'ยาที่แพ้',
    render: r => <><p className="font-medium">{r.med_name}</p><p className="text-xs text-slate-400">{r.med_generic_name}</p></> },
  { key: 'symptoms',    label: 'อาการ', className: 'text-sm max-w-[180px] truncate' },
  { key: 'severity',    label: 'ระดับ',
    render: r => {
      const c = SEV[r.severity as keyof typeof SEV] ?? { label: r.severity, variant: 'gray' as const };
      return <Badge variant={c.variant}>{c.label}</Badge>;
    }},
  { key: 'reported_at', label: 'วันที่',
    render: r => fmtDate(r.reported_at) },
];

export default function AllergyPage() {
  const [form,      setForm]      = useState<typeof emptyForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [reload,    setReload]    = useState(0);
  const [resetKey,  setResetKey]  = useState(0);
  const [drawer,    setDrawer]    = useState<any | null>(null);
  const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const openAdd = () => {
    setForm(emptyForm); setEditingId(null); setResetKey(k => k + 1); setShowModal(true);
  };
  const openEdit = (row: any) => {
    setForm({
      patient_id: row.patient_id, patient_label: row.patient_name || '',
      med_id: row.med_id,         med_label: row.med_name || '',
      symptoms: row.symptoms || '', description: row.description || '',
      severity: row.severity || 'mild',
      reported_at: row.reported_at ? row.reported_at.slice(0, 10) : '',
    });
    setEditingId(row.allr_id); setResetKey(k => k + 1); setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.patient_id) { toast.error('กรุณาเลือกผู้ป่วย'); return; }
    if (!form.med_id)     { toast.error('กรุณาเลือกยา');       return; }
    if (!form.symptoms)   { toast.error('กรุณากรอกอาการ');      return; }
    setSaving(true);
    try {
      const payload = {
        patient_id: form.patient_id, med_id: form.med_id,
        symptoms: form.symptoms, description: form.description,
        severity: form.severity, reported_at: form.reported_at || null,
      };
      if (editingId) { await crudApi.updateAllergy(editingId, payload); toast.success('แก้ไขเรียบร้อย'); }
      else           { await crudApi.createAllergy(payload);            toast.success('เพิ่มเรียบร้อย'); }
      setShowModal(false); setReload(r => r + 1);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <MainLayout title="ทะเบียนการแพ้ยา" subtitle="Allergy Registry"
>
      <DataTable cols={cols}
        fetcher={p => registryApi.getAllergy(p).then(r => r.data)}
        searchPlaceholder="ค้นหาผู้ป่วย, ชื่อยา..."
        emptyIcon={<ShieldAlert size={36} />} emptyText="ไม่พบรายการ"
        deps={[reload]}
        onRowClick={row => setDrawer(row)}
        onAdd={openAdd} addLabel="เพิ่มรายการ"
        actionCol={row => (
          <RowActions
            onView={() => setDrawer(row)}
            onEdit={() => openEdit(row)}
            onDelete={async () => { await crudApi.deleteAllergy(row.allr_id); setReload(r => r + 1); }}
          />
        )}
        deleteConfirmText={row => `ลบบันทึกการแพ้ยาของ "${row.patient_name}"?`}
      />

      <CrudModal open={showModal} onClose={() => setShowModal(false)}
        title="รายการแพ้ยา" editingId={editingId} onSave={handleSave} saving={saving}>
        <FormGrid>
          <SearchSelect type="patient" label="ผู้ป่วย" required
            initialDisplay={form.patient_label} resetKey={resetKey}
            onSelect={p => { f('patient_id', p?.patient_id ?? 0); f('patient_label', p?.full_name ?? ''); }} />
          <SearchSelect type="drug" label="ยาที่แพ้" required
            initialDisplay={form.med_label} resetKey={resetKey}
            onSelect={d => { f('med_id', d?.med_id ?? 0); f('med_label', d?.med_name ?? ''); }} />
          <div className="sm:col-span-2">
            <Textarea label="อาการ" required value={form.symptoms} onChange={e => f('symptoms', e.target.value)} rows={2} />
          </div>
          <div className="sm:col-span-2">
            <Textarea label="รายละเอียด" value={form.description} onChange={e => f('description', e.target.value)} rows={2} />
          </div>
          <Select label="ระดับ" value={form.severity} onChange={e => f('severity', e.target.value)}
            options={Object.entries(SEV).map(([v, { label }]) => ({ value: v, label }))} />
          <Input label="วันที่รายงาน" type="date" value={form.reported_at} onChange={e => f('reported_at', e.target.value)} />
        </FormGrid>
      </CrudModal>

      <DetailDrawer open={!!drawer} onClose={() => setDrawer(null)}
        title={drawer ? `แพ้ยา: ${drawer.med_name}` : ''}
        subtitle={drawer ? `${drawer.patient_name} (HN: ${drawer.hn_number})` : ''}>
        {drawer && (
          <DrawerSection title="รายละเอียดการแพ้ยา">
            <DrawerGrid items={[
              { label: 'ผู้ป่วย',      value: <><p className="font-medium">{drawer.patient_name}</p><p className="text-xs text-slate-400">HN: {drawer.hn_number}</p></> },
              { label: 'ระดับ',        value: <Badge variant={(SEV[drawer.severity as keyof typeof SEV] ?? { variant: 'gray' }).variant}>{SEV[drawer.severity as keyof typeof SEV]?.label ?? drawer.severity}</Badge> },
              { label: 'ยาที่แพ้',     value: <><p className="font-medium">{drawer.med_name}</p><p className="text-xs text-slate-400">{drawer.med_generic_name}</p></>, span: true },
              { label: 'หมวดยา',       value: drawer.med_medical_category || '—' },
              { label: 'วันที่รายงาน', value: fmtDate(drawer.reported_at) },
              { label: 'วันที่บันทึก', value: fmtDate(drawer.created_at, true), span: true },
              { label: 'อาการ',        value: drawer.symptoms, span: true },
              { label: 'รายละเอียด',   value: drawer.description || '—', span: true },
            ]} />
          </DrawerSection>
        )}
        {drawer && (
          <DrawerSection title="">
            <Button variant="secondary" onClick={() => { setDrawer(null); openEdit(drawer); }}>แก้ไข</Button>
          </DrawerSection>
        )}
      </DetailDrawer>
    </MainLayout>
  );
}
