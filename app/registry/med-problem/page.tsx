'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { CrudModal, FormGrid, FormSection, RowActions } from '@/components/CrudModal';
import { Input, Select, Textarea, Badge, Button } from '@/components/ui';
import SearchSelect from '@/components/SearchSelect';
import DetailDrawer, { DrawerSection, DrawerGrid } from '@/components/DetailDrawer';
import { registryApi, crudApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtDate } from '@/lib/dateUtils';

const PROBLEM_TYPES = [
  { value: 'wrong_dose',      label: 'ขนาดยาไม่เหมาะสม' },
  { value: 'duplication',     label: 'ยาซ้ำซ้อน' },
  { value: 'non_compliance',  label: 'ไม่ปฏิบัติตามแผนการรักษา' },
  { value: 'adverse_effect',  label: 'ผลข้างเคียงจากยา' },
  { value: 'interaction',     label: 'ปฏิกิริยาระหว่างยา' },
  { value: 'indication',      label: 'ข้อบ่งชี้ไม่เหมาะสม' },
  { value: 'other',           label: 'อื่นๆ' },
];

const PROBLEM_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  PROBLEM_TYPES.map(t => [t.value, t.label])
);

const TYPE_V: Record<string, 'danger' | 'warning' | 'info' | 'gray'> = {
  wrong_dose:     'danger',
  duplication:    'warning',
  non_compliance: 'warning',
  adverse_effect: 'danger',
  interaction:    'danger',
  indication:     'warning',
  other:          'gray',
};

const emptyForm = {
  med_id: 0,     med_label: '',
  patient_id: 0, patient_label: '',
  reporter_id: 0, reporter_label: '',
  problem_type: '',
  description: '',
  is_resolved: false,
  reported_at: '',
};

const cols: ColDef[] = [
  { key: 'patient_name', label: 'ผู้ป่วย',
    render: r => r.patient_name
      ? <><p className="font-medium">{r.patient_name}</p><p className="text-xs text-slate-400">HN: {r.hn_number}</p></>
      : <span className="text-slate-300">—</span> },
  { key: 'med_name', label: 'ยา',
    render: r => <><p className="font-medium">{r.med_name}</p><p className="text-xs text-slate-400">{r.med_generic_name}</p></> },
  { key: 'problem_type', label: 'ประเภทปัญหา',
    render: r => (
      <Badge variant={TYPE_V[r.problem_type] ?? 'gray'}>
        {PROBLEM_TYPE_LABEL[r.problem_type] || r.problem_type || '—'}
      </Badge>
    )},
  { key: 'description', label: 'คำอธิบาย', className: 'text-xs text-slate-500 max-w-[200px] truncate' },
  { key: 'is_resolved', label: 'สถานะ',
    render: r => <Badge variant={r.is_resolved ? 'success' : 'warning'}>{r.is_resolved ? 'แก้ไขแล้ว' : 'ยังไม่แก้ไข'}</Badge> },
  { key: 'reported_by_name', label: 'ผู้รายงาน', className: 'text-xs text-slate-500' },
  { key: 'reported_at', label: 'วันที่', render: r => fmtDate(r.reported_at) },
];

export default function MedProblemPage() {
  const { user } = useAuth();
  const [form,      setForm]      = useState<typeof emptyForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [reload,    setReload]    = useState(0);
  const [resetKey,  setResetKey]  = useState(0);
  const [drawer,    setDrawer]    = useState<any | null>(null);
  const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const openAdd = () => {
    setForm({
      ...emptyForm,
      reporter_id: user?.role_id ?? 0,
      reporter_label: user?.email ?? '',
      reported_at: new Date().toISOString().slice(0, 16),
    });
    setEditingId(null); setResetKey(k => k + 1); setShowModal(true);
  };

  const openEdit = (row: any) => {
    setForm({
      med_id: row.med_id,         med_label: row.med_name || '',
      patient_id: row.patient_id || 0, patient_label: row.patient_name || '',
      reporter_id: row.reported_by || 0, reporter_label: row.reported_by_name || '',
      problem_type: row.problem_type || '',
      description: row.description || '',
      is_resolved: row.is_resolved ?? false,
      reported_at: row.reported_at ? row.reported_at.slice(0, 16) : '',
    });
    setEditingId(row.mp_id); setResetKey(k => k + 1); setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.patient_id)   { toast.error('กรุณาเลือกผู้ป่วย');      return; }
    if (!form.med_id)       { toast.error('กรุณาเลือกยา');            return; }
    if (!form.problem_type) { toast.error('กรุณาระบุประเภทปัญหา');    return; }
    if (!form.description)  { toast.error('กรุณากรอกคำอธิบาย');       return; }
    setSaving(true);
    try {
      const payload = {
        patient_id:   form.patient_id,
        med_id:       form.med_id,
        problem_type: form.problem_type,
        description:  form.description,
        is_resolved:  form.is_resolved,
        reported_by:  form.reporter_id || user?.id || null,
        reported_at:  form.reported_at || new Date().toISOString(),
      };
      if (editingId) { await crudApi.updateMedProblem(editingId, payload); toast.success('แก้ไขเรียบร้อย'); }
      else           { await crudApi.createMedProblem(payload);            toast.success('เพิ่มเรียบร้อย'); }
      setShowModal(false); setReload(r => r + 1);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <MainLayout title="ปัญหาการใช้ยา" subtitle="Drug-Related Problems (DRP)">
      <DataTable cols={cols}
        fetcher={p => registryApi.getMedProblems(p).then(r => r.data)}
        searchPlaceholder="ค้นหาผู้ป่วย, ยา, คำอธิบาย..."
        emptyIcon={<AlertTriangle size={36} />} emptyText="ไม่พบรายการ"
        deps={[reload]}
        onRowClick={row => setDrawer(row)}
        onAdd={openAdd} addLabel="เพิ่มรายการ"
        actionCol={row => (
          <RowActions
            onView={() => setDrawer(row)}
            onEdit={() => openEdit(row)}
            onDelete={async () => { await crudApi.deleteMedProblem(row.mp_id); setReload(r => r + 1); }}
          />
        )}
        deleteConfirmText={row => `ลบรายการปัญหาการใช้ยาของ "${row.patient_name || row.med_name}"?`}
      />

      <CrudModal open={showModal} onClose={() => setShowModal(false)}
        title="ปัญหาการใช้ยา" editingId={editingId} onSave={handleSave} saving={saving} size="lg">
        <div className="flex flex-col gap-4">
          <FormSection title="ข้อมูลผู้ป่วยและยา">
            <SearchSelect type="patient" label="ผู้ป่วย" required
              initialDisplay={form.patient_label} resetKey={resetKey}
              onSelect={p => { f('patient_id', p?.patient_id ?? 0); f('patient_label', p?.full_name ?? ''); }} />
            <SearchSelect type="drug" label="ยา" required
              initialDisplay={form.med_label} resetKey={resetKey}
              onSelect={d => { f('med_id', d?.med_id ?? 0); f('med_label', d?.med_name ?? ''); }} />
          </FormSection>
          <FormSection title="รายละเอียดปัญหา">
            <Select label="ประเภทปัญหา" required value={form.problem_type}
              onChange={e => f('problem_type', e.target.value)}
              placeholder="เลือกประเภท" options={PROBLEM_TYPES} />
            <Select label="สถานะ" value={String(form.is_resolved)}
              onChange={e => f('is_resolved', e.target.value === 'true')}
              options={[{ value: 'false', label: 'ยังไม่แก้ไข' }, { value: 'true', label: 'แก้ไขแล้ว' }]} />
            <SearchSelect type="user" label="ผู้รายงาน"
              initialDisplay={form.reporter_label} resetKey={resetKey}
              onSelect={u => { f('reporter_id', u?.id ?? null); f('reporter_label', u?.full_name ?? ''); }} />
            <Input label="วันที่รายงาน" type="datetime-local"
              value={form.reported_at} onChange={e => f('reported_at', e.target.value)} />
            <div className="sm:col-span-2">
              <Textarea label="คำอธิบาย" required value={form.description}
                onChange={e => f('description', e.target.value)} rows={4} />
            </div>
          </FormSection>
        </div>
      </CrudModal>

      <DetailDrawer open={!!drawer} onClose={() => setDrawer(null)}
        title={drawer ? `DRP: ${drawer.patient_name || 'ไม่ระบุผู้ป่วย'}` : ''}
        subtitle={drawer ? drawer.med_name : ''}>
        {drawer && (
          <DrawerSection title="รายละเอียดปัญหาการใช้ยา">
            <DrawerGrid items={[
              { label: 'ผู้ป่วย', value: drawer.patient_name
                ? <><p className="font-medium">{drawer.patient_name}</p><p className="text-xs text-slate-400">HN: {drawer.hn_number}</p></>
                : '—' },
              { label: 'สถานะ', value: <Badge variant={drawer.is_resolved ? 'success' : 'warning'}>{drawer.is_resolved ? 'แก้ไขแล้ว' : 'ยังไม่แก้ไข'}</Badge> },
              { label: 'ยา', value: <><p className="font-medium">{drawer.med_name}</p><p className="text-xs text-slate-400">{drawer.med_generic_name || ''}</p></>, span: true },
              { label: 'ประเภทปัญหา', value: (
                <Badge variant={TYPE_V[drawer.problem_type] ?? 'gray'}>
                  {PROBLEM_TYPE_LABEL[drawer.problem_type] || drawer.problem_type || '—'}
                </Badge>
              )},
              { label: 'คำอธิบาย', value: drawer.description, span: true },
              { label: 'วันที่รายงาน', value: fmtDate(drawer.reported_at, true) },
              { label: 'วันที่บันทึก', value: fmtDate(drawer.created_at, true) },
              { label: 'ผู้รายงาน', value: drawer.reported_by_name || '—' },
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
