'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { CrudModal, FormGrid, RowActions } from '@/components/CrudModal';
import { Input, Select, Textarea, Badge, Button } from '@/components/ui';
import SearchSelect from '@/components/SearchSelect';
import DetailDrawer, { DrawerSection, DrawerGrid } from '@/components/DetailDrawer';
import { registryApi, crudApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { FlaskConical } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtDate } from '@/lib/dateUtils';

const SEV_V: Record<string, 'danger' | 'warning' | 'gray'> = {
  severe: 'danger', moderate: 'warning', mild: 'gray',
};

const emptyForm = {
  patient_id: 0, patient_label: '',
  med_id: 0,     med_label: '',
  reporter_id: 0, reporter_label: '',
  description: '', reported_at: '', severity: '', outcome: '', symptoms: '', notes: '',
};

const cols: ColDef[] = [
  { key: 'patient_name', label: 'ผู้ป่วย',
    render: r => <><p className="font-medium">{r.patient_name}</p><p className="text-xs text-slate-400">{r.hn_number}</p></> },
  { key: 'med_name', label: 'ยา',
    render: r => <><p className="font-medium">{r.med_name}</p><p className="text-xs text-slate-400">{r.med_generic_name}</p></> },
  { key: 'symptoms',      label: 'อาการ',     className: 'text-xs max-w-[160px] truncate' },
  { key: 'severity',      label: 'ระดับ',
    render: r => <Badge variant={SEV_V[r.severity] ?? 'gray'}>{r.severity || '-'}</Badge> },
  { key: 'outcome',       label: 'ผลลัพธ์',   className: 'text-xs text-slate-500' },
  { key: 'reporter_name', label: 'ผู้รายงาน', className: 'text-xs text-slate-500' },
  { key: 'reported_at',   label: 'วันที่',
    render: r => fmtDate(r.reported_at) },
];

export default function AdrPage() {
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
    });
    setEditingId(null); setResetKey(k => k + 1); setShowModal(true);
  };

  const openEdit = (row: any) => {
    setForm({
      patient_id: row.patient_id, patient_label: row.patient_name || '',
      med_id: row.med_id,         med_label: row.med_name || '',
      reporter_id: row.reporter_id || 0, reporter_label: row.reporter_name || '',
      description: row.description || '',
      reported_at: row.reported_at ? row.reported_at.slice(0, 16) : '',
      severity: row.severity || '', outcome: row.outcome || '',
      symptoms: row.symptoms || '', notes: row.notes || '',
    });
    setEditingId(row.adr_id); setResetKey(k => k + 1); setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.patient_id)  { toast.error('กรุณาเลือกผู้ป่วย'); return; }
    if (!form.med_id)      { toast.error('กรุณาเลือกยา');       return; }
    if (!form.description) { toast.error('กรุณากรอกคำอธิบาย');  return; }
    if (!form.reported_at) { toast.error('กรุณาระบุวันที่');     return; }
    setSaving(true);
    try {
      const payload = {
        patient_id: form.patient_id, med_id: form.med_id,
        reporter_id: form.reporter_id || user?.uid || null,
        description: form.description, reported_at: form.reported_at,
        severity: form.severity, outcome: form.outcome,
        symptoms: form.symptoms, notes: form.notes,
      };
      if (editingId) { await crudApi.updateAdr(editingId, payload); toast.success('แก้ไขเรียบร้อย'); }
      else           { await crudApi.createAdr(payload);            toast.success('เพิ่มเรียบร้อย'); }
      setShowModal(false); setReload(r => r + 1);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <MainLayout title="ทะเบียน ADR" subtitle="Adverse Drug Reaction"
>
      <DataTable cols={cols}
        fetcher={p => registryApi.getAdr(p).then(r => r.data)}
        searchPlaceholder="ค้นหาผู้ป่วย, ชื่อยา..."
        emptyIcon={<FlaskConical size={36} />} emptyText="ไม่พบรายการ"
        deps={[reload]}
        onRowClick={row => setDrawer(row)}
        onAdd={openAdd} addLabel="เพิ่ม ADR"
        actionCol={row => (
          <RowActions
            onView={() => setDrawer(row)}
            onEdit={() => openEdit(row)}
            onDelete={async () => { await crudApi.deleteAdr(row.adr_id); setReload(r => r + 1); }}
          />
        )}
        deleteConfirmText={row => `ลบ ADR ของ "${row.patient_name}"?`}
      />

      <CrudModal open={showModal} onClose={() => setShowModal(false)}
        title="ADR" editingId={editingId} onSave={handleSave} saving={saving} size="lg">
        <FormGrid>
          <SearchSelect type="patient" label="ผู้ป่วย" required
            initialDisplay={form.patient_label} resetKey={resetKey}
            onSelect={p => { f('patient_id', p?.patient_id ?? 0); f('patient_label', p?.full_name ?? ''); }} />
          <SearchSelect type="drug" label="ยาที่เกิด ADR" required
            initialDisplay={form.med_label} resetKey={resetKey}
            onSelect={d => { f('med_id', d?.med_id ?? 0); f('med_label', d?.med_name ?? ''); }} />
          <SearchSelect type="user" label="ผู้รายงาน"
            initialDisplay={form.reporter_label} resetKey={resetKey}
            onSelect={u => { f('reporter_id', u?.uid ?? 0); f('reporter_label', u?.full_name ?? ''); }} />
          <Input label="วันที่รายงาน" required type="datetime-local"
            value={form.reported_at} onChange={e => f('reported_at', e.target.value)} />
          <Select label="ระดับ" value={form.severity} onChange={e => f('severity', e.target.value)}
            placeholder="เลือก" options={['mild','moderate','severe'].map(s => ({ value: s, label: s }))} />
          <Input label="ผลลัพธ์" value={form.outcome} onChange={e => f('outcome', e.target.value)}
            placeholder="recovered, not recovered..." />
          <div className="sm:col-span-2">
            <Textarea label="คำอธิบาย" required value={form.description} onChange={e => f('description', e.target.value)} rows={3} />
          </div>
          <Textarea label="อาการ" value={form.symptoms} onChange={e => f('symptoms', e.target.value)} rows={2} />
          <Textarea label="หมายเหตุ" value={form.notes} onChange={e => f('notes', e.target.value)} rows={2} />
        </FormGrid>
      </CrudModal>

      <DetailDrawer open={!!drawer} onClose={() => setDrawer(null)}
        title={drawer ? `ADR: ${drawer.med_name}` : ''}
        subtitle={drawer ? `${drawer.patient_name} · ${drawer.reporter_name || ''}` : ''}>
        {drawer && (
          <DrawerSection title="รายละเอียด ADR">
            <DrawerGrid items={[
              { label: 'ผู้ป่วย',      value: <><p className="font-medium">{drawer.patient_name}</p><p className="text-xs text-slate-400">HN: {drawer.hn_number}</p></> },
              { label: 'ระดับ',        value: <Badge variant={SEV_V[drawer.severity] ?? 'gray'}>{drawer.severity || '—'}</Badge> },
              { label: 'ยา',           value: <><p className="font-medium">{drawer.med_name}</p><p className="text-xs text-slate-400">{drawer.med_generic_name || ''}</p></>, span: true },
              { label: 'อาการ',        value: drawer.symptoms || '—', span: true },
              { label: 'คำอธิบาย',    value: drawer.description, span: true },
              { label: 'ผลลัพธ์',     value: drawer.outcome || '—' },
              { label: 'ผู้รายงาน',   value: drawer.reporter_name || '—' },
              { label: 'วันที่รายงาน', value: fmtDate(drawer.reported_at, true), span: true },
              { label: 'วันที่บันทึก', value: fmtDate(drawer.created_at, true), span: true },
              { label: 'หมายเหตุ',    value: drawer.notes || '—', span: true },
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
