'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { CrudModal, FormSection, RowActions } from '@/components/CrudModal';
import { Input, Badge, ConfirmDialog, Modal, Button } from '@/components/ui';
import SearchSelect from '@/components/SearchSelect';
import RegistryDrawer from '@/components/RegistryDrawer';
import { registryApi, crudApi } from '@/lib/api';
import { useConfirm } from '@/hooks/useConfirm';
import { Clock, Pill } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtDate } from '@/lib/dateUtils';

const cols: ColDef[] = [
  {
    key: 'med_name', label: 'ชื่อยา',
    render: r => <><p className="font-medium">{r.sub_drug_name || r.med_name}</p><p className="text-xs text-slate-400">{r.med_generic_name}</p></>
  },
  {
    key: 'patient_name', label: 'ผู้ป่วย',
    render: r => <><p className="font-medium">{r.patient_name || '-'}</p><p className="text-xs text-slate-400">{r.hn_number}</p></>
  },
  {
    key: 'quantity', label: 'จำนวน',
    render: r => <span className="font-semibold">{r.quantity} <span className="text-xs font-normal text-slate-400">{r.unit || ''}</span></span>
  },
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

const emptyForm = {
  med_id: 0, med_label: '',
  med_sid: 0, med_sid_label: '',
  patient_id: 0, patient_label: '',
  doctor_id: '' as string, doctor_label: '',
  quantity: '',
};

const emptyDispenseForm = { med_sid: 0, drug_sub_label: '', quantity: '' };

export default function OverduePage() {
  const [reload, setReload] = useState(0);
  const [drawer, setDrawer] = useState<any | null>(null);
  const { confirm: alertDialog, dialogProps: alertDialogProps } = useConfirm();

  // CRUD
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  const clearErr = (k: string) => setErrors(p => ({ ...p, [k]: '' }));

  // Dispense
  const [dispenseRow, setDispenseRow] = useState<any | null>(null);
  const [dispenseForm, setDispenseForm] = useState(emptyDispenseForm);
  const [dispenseResetKey, setDispenseResetKey] = useState(0);
  const [dispenseErrors, setDispenseErrors] = useState<Record<string, string>>({});
  const [dispensing, setDispensing] = useState(false);
  const df = (k: string, v: any) => setDispenseForm(p => ({ ...p, [k]: v }));

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null); setResetKey(k => k + 1); setErrors({}); setShowModal(true);
  };

  const openEdit = (row: any) => {
    setForm({
      med_id: row.med_id || 0, med_label: row.med_name || '',
      med_sid: row.med_sid || 0, med_sid_label: row.sub_drug_name || '',
      patient_id: row.patient_id || 0, patient_label: row.patient_name || '',
      doctor_id: row.doctor_id || '', doctor_label: row.doctor_name || '',
      quantity: row.quantity != null ? String(row.quantity) : '',
    });
    setEditingId(row.overdue_id); setResetKey(k => k + 1); setErrors({}); setShowModal(true);
  };

  const handleSave = async () => {
    const errs: Record<string, string> = {};
    if (!form.med_id) errs.med_id = 'กรุณาเลือกยา';
    if (!form.quantity || Number(form.quantity) <= 0) errs.quantity = 'กรุณาระบุจำนวน';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const payload = {
        med_id: form.med_id,
        med_sid: form.med_sid || undefined,
        patient_id: form.patient_id || undefined,
        doctor_id: form.doctor_id || undefined,
        quantity: Number(form.quantity),
      };
      if (editingId) {
        await crudApi.updateOverdue(editingId, payload);
        toast.success('แก้ไขเรียบร้อย');
      } else {
        await crudApi.createOverdue(payload);
        toast.success('เพิ่มเรียบร้อย');
      }
      setShowModal(false); setReload(r => r + 1);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const openDispenseModal = (row: any) => {
    setDispenseForm({
      med_sid: row.med_sid || 0,
      drug_sub_label: row.sub_drug_name || '',
      quantity: row.quantity ? String(row.quantity) : '',
    });
    setDispenseErrors({});
    setDispenseResetKey(k => k + 1);
    setDispenseRow(row);
  };

  const handleDispense = async () => {
    const errs: Record<string, string> = {};
    if (!dispenseForm.med_sid) errs.med_sid = 'กรุณาเลือกยาในคลัง';
    if (!dispenseForm.quantity || Number(dispenseForm.quantity) <= 0) errs.quantity = 'กรุณาระบุจำนวน';
    if (Object.keys(errs).length) { setDispenseErrors(errs); return; }
    setDispensing(true);
    try {
      await crudApi.updateOverdue(dispenseRow.overdue_id, {
        dispense_status: true,
        med_sid: dispenseForm.med_sid,
        quantity: Number(dispenseForm.quantity),
      });
      toast.success('จ่ายยาเรียบร้อย');
      setDispenseRow(null);
      setReload(r => r + 1);
    } catch (e: any) {
      await alertDialog({
        title: 'ไม่สามารถจ่ายยาได้',
        message: e.message,
        variant: 'warning',
        alertOnly: true,
      });
    } finally { setDispensing(false); }
  };

  return (
    <MainLayout title="ทะเบียนยาค้างจ่าย" subtitle="Overdue Medication Registry">
      <DataTable cols={cols}
        fetcher={p => registryApi.getOverdueMed(p).then(r => r.data)}
        searchPlaceholder="ค้นหาชื่อยา, ผู้ป่วย..."
        emptyIcon={<Clock size={36} />} emptyText="ไม่มียาค้างจ่าย 🎉"
        deps={[reload]}
        onRowClick={row => setDrawer(row)}
        onAdd={openAdd} addLabel="เพิ่มรายการ"
        actionCol={row => (
          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
            <RowActions
              onView={() => setDrawer(row)}
              onEdit={() => openEdit(row)}
              onDelete={async () => { await crudApi.deleteOverdue(row.overdue_id); setReload(r => r + 1); }}
            />
            {!row.dispense_status && (
              <button onClick={() => openDispenseModal(row)}
                className="px-2 py-1 rounded text-xs bg-green-50 text-green-700 hover:bg-green-100 font-medium">
                จ่ายยา
              </button>
            )}
          </div>
        )}
        deleteConfirmText={row => `ลบรายการยาค้างจ่าย "${row.sub_drug_name || row.med_name}"?`}
      />

      <ConfirmDialog {...alertDialogProps} />

      {/* Add / Edit Modal */}
      <CrudModal open={showModal} onClose={() => setShowModal(false)}
        title="ยาค้างจ่าย" editingId={editingId} onSave={handleSave} saving={saving}>
        <div className="flex flex-col gap-4">
          <FormSection title="ยาและผู้ป่วย">
            <div>
              <SearchSelect type="drug" label="ยา" required
                initialDisplay={form.med_label} resetKey={resetKey}
                onSelect={d => { f('med_id', d?.med_id ?? 0); f('med_label', d?.med_name ?? ''); clearErr('med_id'); }} />
              {errors.med_id && <p className="mt-1 text-xs text-red-500">{errors.med_id}</p>}
            </div>
            <SearchSelect type="subwarehouse" label="ยาในคลัง (ถ้ามี)"
              initialDisplay={form.med_sid_label} resetKey={resetKey}
              onSelect={s => { f('med_sid', s?.med_sid ?? 0); f('med_sid_label', s ? (s.med_showname || s.med_name) : ''); }} />
            <SearchSelect type="patient" label="ผู้ป่วย"
              initialDisplay={form.patient_label} resetKey={resetKey}
              onSelect={p => { f('patient_id', p?.patient_id ?? 0); f('patient_label', p?.full_name ?? ''); }} />
            <SearchSelect type="user" label="แพทย์"
              initialDisplay={form.doctor_label} resetKey={resetKey}
              onSelect={u => { f('doctor_id', u?.id ?? ''); f('doctor_label', u?.full_name ?? ''); }} />
          </FormSection>
          <FormSection title="จำนวน">
            <div>
              <Input label="จำนวน" required type="number" min="1"
                value={form.quantity}
                onChange={e => { f('quantity', e.target.value); clearErr('quantity'); }}
                error={errors.quantity} />
            </div>
          </FormSection>
        </div>
      </CrudModal>

      {/* Dispense Modal */}
      <Modal open={!!dispenseRow} onClose={() => setDispenseRow(null)}
        title="จ่ายยาค้างจ่าย" size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDispenseRow(null)}>ยกเลิก</Button>
            <Button variant="primary" onClick={handleDispense} loading={dispensing} icon={<Pill size={14} />}>
              ยืนยันจ่ายยา
            </Button>
          </div>
        }
      >
        {dispenseRow && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl bg-slate-50 px-4 py-3 border border-slate-100">
              <p className="text-sm font-semibold text-slate-700">{dispenseRow.sub_drug_name || dispenseRow.med_name}</p>
              {dispenseRow.med_generic_name && <p className="text-xs text-slate-400 mt-0.5">{dispenseRow.med_generic_name}</p>}
              {dispenseRow.patient_name && (
                <p className="text-xs text-slate-500 mt-1">ผู้ป่วย: {dispenseRow.patient_name} {dispenseRow.hn_number ? `(HN: ${dispenseRow.hn_number})` : ''}</p>
              )}
            </div>
            <div>
              <SearchSelect type="subwarehouse" label="ยาในคลัง" required
                initialDisplay={dispenseForm.drug_sub_label}
                resetKey={dispenseResetKey}
                onSelect={s => {
                  df('med_sid', s?.med_sid ?? 0);
                  df('drug_sub_label', s ? (s.med_showname || s.med_name) : '');
                  if (dispenseErrors.med_sid) setDispenseErrors(p => ({ ...p, med_sid: '' }));
                }} />
              {dispenseErrors.med_sid && <p className="mt-1 text-xs text-red-500">{dispenseErrors.med_sid}</p>}
            </div>
            <Input label="จำนวน" required type="number" min="1"
              value={dispenseForm.quantity}
              onChange={e => { df('quantity', e.target.value); if (dispenseErrors.quantity) setDispenseErrors(p => ({ ...p, quantity: '' })); }}
              error={dispenseErrors.quantity} />
          </div>
        )}
      </Modal>

      <RegistryDrawer
        open={!!drawer} onClose={() => setDrawer(null)} row={drawer}
        title="ยาค้างจ่าย" subtitle={r => r.med_name}
        fields={[
          { label: 'ชื่อยา', key: 'sub_drug_name', type: 'template', template: r => r.sub_drug_name || r.med_name || '-' },
          { label: 'ผู้ป่วย', key: '_patient', type: 'patient' },
          { label: 'จำนวน', key: 'quantity', type: 'template', template: r => r.unit ? `${r.quantity} ${r.unit}` : String(r.quantity ?? '-') },
          { label: 'แพทย์', key: 'doctor_name' },
          { label: 'สถานะ', key: 'dispense_status', type: 'template', template: r => r.dispense_status ? 'จ่ายแล้ว' : 'ค้างจ่าย' },
          { label: 'วันที่', key: 'time', type: 'datetime' },
        ]}
      />
    </MainLayout>
  );
}
