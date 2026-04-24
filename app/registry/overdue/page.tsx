'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { CrudModal, FormGrid, RowActions } from '@/components/CrudModal';
import { Input, Badge, ConfirmDialog } from '@/components/ui';
import SearchSelect from '@/components/SearchSelect';
import RegistryDrawer from '@/components/RegistryDrawer';
import { registryApi, crudApi } from '@/lib/api';
import { useConfirm } from '@/hooks/useConfirm';
import { Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtDate } from '@/lib/dateUtils';

const STATUS_MAP = {
  true: { label: 'จ่ายแล้ว', variant: 'success' as const },
  false: { label: 'ค้างจ่าย', variant: 'warning' as const },
};

const emptyForm = {
  med_id: 0, med_label: '', patient_id: 0, patient_label: '',
  doctor_id: 0, doctor_label: '', med_sid: 0, drug_sub_label: '', quantity: '',
};

const cols: ColDef[] = [
  {
    key: 'med_name', label: 'ชื่อยา',
    render: r => <><p className="font-medium">{r.med_name}</p><p className="text-xs text-slate-400">{r.med_generic_name}</p></>
  },
  {
    key: 'patient_name', label: 'ผู้ป่วย',
    render: r => <><p className="font-medium">{r.patient_name || '-'}</p><p className="text-xs text-slate-400">{r.hn_number}</p></>
  },
  { key: 'quantity', label: 'จำนวน', className: 'font-semibold' },
  { key: 'doctor_name', label: 'แพทย์', className: 'text-xs' },
  {
    key: 'dispense_status', label: 'สถานะ',
    render: r => <Badge variant={r.dispense_status ? 'success' : 'warning'} dot>{r.dispense_status ? 'จ่ายแล้ว' : 'ค้างจ่าย'}</Badge>
  },
  {
    key: 'time', label: 'วันที่',
    render: r => fmtDate(r.time, true)
  },
];

export default function OverduePage() {
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [drawer, setDrawer] = useState<any | null>(null);
  const { confirm: alertDialog, dialogProps: alertDialogProps } = useConfirm();
  const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const openAdd = () => { setForm(emptyForm); setEditingId(null); setResetKey(k => k + 1); setShowModal(true); };
  const openEdit = (row: any) => {
    setForm({
      med_id: row.med_id, med_label: row.med_name || '',
      patient_id: row.patient_id || 0, patient_label: row.patient_name || '',
      doctor_id: row.doctor_id || 0, doctor_label: row.doctor_name || '',
      med_sid: row.med_sid || 0, drug_sub_label: row.sub_drug_name || '',
      quantity: row.quantity ? String(row.quantity) : ''
    });
    setEditingId(row.overdue_id); setResetKey(k => k + 1); setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.med_id) { toast.error('กรุณาเลือกยา'); return; }
    setSaving(true);
    try {
      const payload = {
        med_id: form.med_id, patient_id: form.patient_id || null,
        doctor_id: form.doctor_id || null, med_sid: form.med_sid || null,
        quantity: form.quantity ? Number(form.quantity) : null
      };
      if (editingId) { await crudApi.updateOverdue(editingId, payload); toast.success('แก้ไขแล้ว'); }
      else { await crudApi.createOverdue(payload); toast.success('เพิ่มแล้ว'); }
      setShowModal(false); setReload(r => r + 1);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const markDispensed = async (row: any) => {
    try {
      await crudApi.updateOverdue(row.overdue_id, { dispense_status: true });
      setReload(r => r + 1);
      toast.success('จ่ายยาเรียบร้อย');
    } catch (e: any) {
      await alertDialog({
        title: 'ไม่สามารถจ่ายยาได้',
        message: e.message,
        variant: 'warning',
        alertOnly: true,
      });
    }
  };

  return (
    <MainLayout title="ทะเบียนยาค้างจ่าย" subtitle="Overdue Medication Registry"
>
      <DataTable cols={cols}
        fetcher={p => registryApi.getOverdueMed(p).then(r => r.data)}
        searchPlaceholder="ค้นหาชื่อยา, ผู้ป่วย..."
        emptyIcon={<Clock size={36} />} emptyText="ไม่มียาค้างจ่าย 🎉"
        deps={[reload]} onAdd={openAdd} addLabel="เพิ่มรายการ"
        onRowClick={row => setDrawer(row)}
        actionCol={row => (
          <div className="flex items-center justify-end gap-1">
            <RowActions onView={() => setDrawer(row)} onEdit={() => openEdit(row)}
              onDelete={async () => { await crudApi.deleteOverdue(row.overdue_id); setReload(r => r + 1); }} />
            {!row.dispense_status && (
              <button onClick={e => { e.stopPropagation(); markDispensed(row); }}
                className="px-2 py-1 rounded text-xs bg-green-50 text-green-700 hover:bg-green-100 font-medium">
                จ่ายยา
              </button>
            )}
          </div>
        )}
        deleteConfirmText={row => `ลบรายการ "${row.med_name}"?`}
      />

      <CrudModal open={showModal} onClose={() => setShowModal(false)}
        title="ยาค้างจ่าย" editingId={editingId} onSave={handleSave} saving={saving}>
        <FormGrid>
          <SearchSelect type="drug" label="ยา (ทะเบียนยา)" required initialDisplay={form.med_label} resetKey={resetKey}
            onSelect={d => { f('med_id', d?.med_id ?? 0); f('med_label', d?.med_name ?? ''); }} />
          <SearchSelect type="subwarehouse" label="ยาในคลัง" initialDisplay={form.drug_sub_label} resetKey={resetKey}
            onSelect={s => { f('med_sid', s?.med_sid ?? 0); f('drug_sub_label', s ? (s.med_showname || s.med_name) : ''); }} />
          <SearchSelect type="patient" label="ผู้ป่วย" initialDisplay={form.patient_label} resetKey={resetKey}
            onSelect={p => { f('patient_id', p?.patient_id ?? 0); f('patient_label', p?.full_name ?? ''); }} />
          <SearchSelect type="user" label="แพทย์" initialDisplay={form.doctor_label} resetKey={resetKey}
            onSelect={u => { f('doctor_id', u?.uid ?? 0); f('doctor_label', u?.full_name ?? ''); }} />
          <Input label="จำนวน" type="number" min="1" value={form.quantity} onChange={e => f('quantity', e.target.value)} />
        </FormGrid>
      </CrudModal>

      <ConfirmDialog {...alertDialogProps} />

      <RegistryDrawer
        open={!!drawer} onClose={() => setDrawer(null)} row={drawer}
        title="ยาค้างจ่าย" subtitle={r => r.med_name}
        onEdit={openEdit}
        fields={[
          { label: 'ชื่อยา (ทะเบียน)', key: '_drug', type: 'drug' },
          { label: 'รายการในคลัง', key: 'sub_drug_name' },
          { label: 'รูปแบบ/บรรจุ', key: 'packaging_type' },
          { label: 'ที่เก็บ', key: 'location' },
          { label: 'ผู้ป่วย', key: '_patient', type: 'patient' },
          { label: 'แพทย์', key: 'doctor_name' },
          { label: 'จำนวน', key: 'quantity' },
          {
            label: 'สถานะ', key: 'dispense_status', type: 'template',
            template: r => r.dispense_status ? 'จ่ายแล้ว' : 'ค้างจ่าย'
          },
          { label: 'วันที่', key: 'time', type: 'datetime' },
        ]}
      />
    </MainLayout>
  );
}
