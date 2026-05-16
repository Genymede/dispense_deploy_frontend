'use client';
import React, { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { CrudModal, FormSection, FormGrid, RowActions } from '@/components/CrudModal';
import { Input, Select, Textarea, Badge, Button } from '@/components/ui';
import SearchSelect from '@/components/SearchSelect';
import DetailDrawer, { DrawerSection } from '@/components/DetailDrawer';
import { registryApi, crudApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtDate } from '@/lib/dateUtils';

const SEV = {
  mild: { label: 'เล็กน้อย', variant: 'gray' as const },
  moderate: { label: 'ปานกลาง', variant: 'warning' as const },
  severe: { label: 'รุนแรง', variant: 'danger' as const },
};

const emptyForm = {
  patient_id: 0, patient_label: '',
  med_id: 0, med_label: '',
  symptoms: '', description: '', severity: 'mild', reported_at: '',
  recorded_by_id: null as string | null, recorded_by_label: '',
};

const cols: ColDef[] = [
  {
    key: 'patient_name', label: 'ผู้ป่วย',
    render: r => <><p className="font-medium">{r.patient_name}</p><p className="text-xs text-slate-400">{r.hn_number}</p></>
  },
  {
    key: 'med_name', label: 'ยาที่แพ้',
    render: r => <><p className="font-medium">{r.med_name}</p><p className="text-xs text-slate-400">{r.med_generic_name}</p></>
  },
  { key: 'symptoms', label: 'อาการ', className: 'text-sm max-w-[180px] truncate' },
  {
    key: 'severity', label: 'ระดับ',
    render: r => {
      const c = SEV[r.severity as keyof typeof SEV] ?? { label: r.severity, variant: 'gray' as const };
      return <Badge variant={c.variant}>{c.label}</Badge>;
    }
  },
  {
    key: 'reported_at', label: 'วันที่',
    render: r => fmtDate(r.reported_at)
  },
  { key: 'recorded_by_name', label: 'ผู้บันทึก', className: 'text-xs text-slate-500' },
];

export default function AllergyPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [drawer, setDrawer] = useState<any | null>(null);
  const [errors, setErrors] = useState<Record<string,string>>({});
  const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  const clearErr = (k: string) => { if (errors[k]) setErrors(p => ({ ...p, [k]: '' })); };

  const C = ({ label, value, span }: { label: string; value: React.ReactNode; span?: boolean }) => (
    <div className={`bg-slate-50 rounded-xl px-3 py-2.5 ${span ? 'col-span-2' : ''}`}>
      <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      <div className="text-sm font-medium text-slate-800 break-words">{value || <span className="text-slate-300">—</span>}</div>
    </div>
  );

  const openAdd = () => {
    setForm({ ...emptyForm, recorded_by_id: user?.id ?? null, recorded_by_label: user?.email ?? '' });
    setEditingId(null); setResetKey(k => k + 1); setErrors({}); setShowModal(true);
  };
  const openEdit = (row: any) => {
    setForm({
      patient_id: row.patient_id, patient_label: row.patient_name || '',
      med_id: row.med_id, med_label: row.med_name || '',
      symptoms: row.symptoms || '', description: row.description || '',
      severity: row.severity || 'mild',
      reported_at: row.reported_at ? row.reported_at.slice(0, 10) : '',
      recorded_by_id: row.recorded_by ?? null, recorded_by_label: row.recorded_by_name ?? '',
    });
    setEditingId(row.allr_id); setResetKey(k => k + 1); setErrors({}); setShowModal(true);
  };

  const handleSave = async () => {
    const errs: Record<string,string> = {};
    if (!form.patient_id) errs.patient_id = 'กรุณาเลือกผู้ป่วย';
    if (!form.med_id) errs.med_id = 'กรุณาเลือกยา';
    if (!form.symptoms.trim()) errs.symptoms = 'กรุณากรอกอาการ';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const payload = {
        patient_id: form.patient_id, med_id: form.med_id,
        symptoms: form.symptoms, description: form.description,
        severity: form.severity, reported_at: form.reported_at || null,
        recorded_by: form.recorded_by_id || user?.id || null,
      };
      if (editingId) { await crudApi.updateAllergy(editingId, payload); toast.success('แก้ไขเรียบร้อย'); }
      else { await crudApi.createAllergy(payload); toast.success('เพิ่มเรียบร้อย'); }
      setShowModal(false); setReload(r => r + 1);
    } catch (e: any) {
      if (!editingId && e.message?.includes('มีอยู่แล้ว')) setErrors({ med_id: e.message });
      else toast.error(e.message);
    }
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
        <div className="flex flex-col gap-4">
          <FormSection title="ข้อมูลผู้ป่วยและยา">
            <div>
              <SearchSelect type="patient" label="ผู้ป่วย" required
                initialDisplay={form.patient_label} resetKey={resetKey}
                onSelect={p => { f('patient_id', p?.patient_id ?? 0); f('patient_label', p?.full_name ?? ''); clearErr('patient_id'); }} />
              {errors.patient_id && <p className="mt-1 text-xs text-red-500">{errors.patient_id}</p>}
            </div>
            <div>
              <SearchSelect type="drug" label="ยาที่แพ้" required
                initialDisplay={form.med_label} resetKey={resetKey}
                onSelect={d => { f('med_id', d?.med_id ?? 0); f('med_label', d?.med_name ?? ''); clearErr('med_id'); }} />
              {errors.med_id && <p className="mt-1 text-xs text-red-500">{errors.med_id}</p>}
            </div>
          </FormSection>
          <FormSection title="รายละเอียดอาการ">
            <div className="sm:col-span-2">
              <Textarea label="อาการ" required value={form.symptoms}
                onChange={e => { f('symptoms', e.target.value); clearErr('symptoms'); }} rows={2}
                error={errors.symptoms} />
            </div>
            <div className="sm:col-span-2">
              <Textarea label="รายละเอียดเพิ่มเติม" value={form.description} onChange={e => f('description', e.target.value)} rows={2} />
            </div>
            <Select label="ระดับความรุนแรง" value={form.severity} onChange={e => f('severity', e.target.value)}
              options={Object.entries(SEV).map(([v, { label }]) => ({ value: v, label }))} />
            <Input label="วันที่รายงาน" type="date" value={form.reported_at} onChange={e => f('reported_at', e.target.value)} />
          </FormSection>
          <FormGrid cols={1}>
            <SearchSelect type="user" label="ผู้บันทึกข้อมูล"
              initialDisplay={form.recorded_by_label} resetKey={resetKey}
              onSelect={u => { f('recorded_by_id', u?.id ?? null); f('recorded_by_label', u?.full_name ?? ''); }} />
          </FormGrid>
        </div>
      </CrudModal>

      <DetailDrawer open={!!drawer} onClose={() => setDrawer(null)}
        width="lg"
        title={drawer ? `แพ้ยา: ${drawer.med_name}` : ''}
        subtitle={drawer ? `${drawer.patient_name} · HN: ${drawer.hn_number}` : ''}
        footer={drawer && (
          <Button variant="secondary" onClick={() => { setDrawer(null); openEdit(drawer); }}>แก้ไข</Button>
        )}>
        {drawer && (
          <div className="flex gap-4">
            {/* ซ้าย */}
            <div className="w-[42%] flex flex-col gap-3">
              <DrawerSection title="ยาที่แพ้">
                <div className="flex flex-col gap-2">
                  <C label="ชื่อยา" value={drawer.med_name} />
                  <C label="ชื่อสามัญ" value={drawer.med_generic_name} />
                </div>
              </DrawerSection>
              <DrawerSection title="ผู้ป่วย">
                <div className="grid grid-cols-2 gap-2">
                  <C label="ชื่อ-นามสกุล" value={drawer.patient_name} span />
                  <C label="HN" value={drawer.hn_number} />
                  <C label="ระดับ" value={
                    <Badge variant={(SEV[drawer.severity as keyof typeof SEV] ?? { variant: 'gray' as const }).variant}>
                      {SEV[drawer.severity as keyof typeof SEV]?.label ?? drawer.severity}
                    </Badge>
                  } />
                  <C label="วันที่รายงาน" value={fmtDate(drawer.reported_at)} span />
                  <C label="ผู้บันทึก" value={drawer.recorded_by_name} span />
                  <C label="วันที่บันทึก" value={fmtDate(drawer.created_at, true)} span />
                </div>
              </DrawerSection>
            </div>
            {/* ขวา */}
            <div className="flex-1 flex flex-col gap-3">
              <DrawerSection title="รายละเอียดอาการ">
                <div className="flex flex-col gap-2">
                  <C label="อาการ" value={drawer.symptoms} />
                  <C label="รายละเอียดเพิ่มเติม" value={drawer.description} />
                </div>
              </DrawerSection>
            </div>
          </div>
        )}
      </DetailDrawer>
    </MainLayout>
  );
}
