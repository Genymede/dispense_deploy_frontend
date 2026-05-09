'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { CrudModal, FormGrid, RowActions } from '@/components/CrudModal';
import { Input, Select, Textarea, Badge } from '@/components/ui';
import SearchSelect from '@/components/SearchSelect';
import RegistryDrawer from '@/components/RegistryDrawer';
import { registryApi, crudApi } from '@/lib/api';
import { phone as validatePhone } from '@/lib/validate';
import { Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtDate } from '@/lib/dateUtils';

const STATUS_MAP = {
  Pending: { label: 'รอดำเนินการ', variant: 'warning' as const },
  Processing: { label: 'กำลังส่ง', variant: 'info' as const },
  Delivered: { label: 'ส่งแล้ว', variant: 'success' as const },
  Cancelled: { label: 'ยกเลิก', variant: 'danger' as const },
};

const emptyForm = {
  patient_id: 0, patient_label: '', delivery_method: '',
  receiver_name: '', receiver_phone: '', address: '', note: '', status: 'Pending',
};

const cols: ColDef[] = [
  {
    key: 'patient_name', label: 'ชื่อผู้ป่วย',
    render: r => <><p className="font-medium">{r.patient_name}</p><p className="text-xs text-slate-400">{r.hn_number}</p></>
  },
  { key: 'receiver_name', label: 'ชื่อผู้รับ', className: 'text-sm' },
  { key: 'receiver_phone', label: 'เบอร์โทรศัพท์ผู้รับ', className: 'text-xs font-mono' },
  { key: 'delivery_method', label: 'วิธีส่ง', className: 'text-xs' },
  {
    key: 'status', label: 'สถานะ',
    render: r => { const c = STATUS_MAP[r.status as keyof typeof STATUS_MAP] ?? { label: r.status, variant: 'gray' as const }; return <Badge variant={c.variant}>{c.label}</Badge>; }
  },
  {
    key: 'delivery_date', label: 'วันที่',
    render: r => fmtDate(r.delivery_date)
  },
];

export default function DeliveryPage() {
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

  const openAdd = () => {
    setForm(emptyForm); setErrors({});
    setEditingId(null); setResetKey(k => k + 1); setShowModal(true);
  };
  const openEdit = (row: any) => {
    setForm({
      patient_id: row.patient_id, patient_label: row.patient_name || '',
      delivery_method: row.delivery_method || '', receiver_name: row.receiver_name || '',
      receiver_phone: row.receiver_phone || '', address: row.address || '',
      note: row.note || '', status: row.status || 'Pending',
    });
    setErrors({});
    setEditingId(row.delivery_id); setResetKey(k => k + 1); setShowModal(true);
  };

  const handleSave = async () => {
    const errs: Record<string,string> = {};
    if (!form.patient_id) errs.patient_id = 'กรุณาเลือกผู้ป่วย';
    if (!form.delivery_method) errs.delivery_method = 'กรุณาเลือกวิธีจัดส่ง';
    if (!form.receiver_name.trim()) errs.receiver_name = 'กรุณากรอกชื่อผู้รับ';
    if (!form.receiver_phone.trim()) errs.receiver_phone = 'กรุณากรอกเบอร์โทร';
    else { const e = validatePhone(form.receiver_phone); if (e) errs.receiver_phone = e; }
    if (!form.address.trim()) errs.address = 'กรุณากรอกที่อยู่';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const payload = {
        patient_id: form.patient_id, delivery_method: form.delivery_method,
        receiver_name: form.receiver_name, receiver_phone: form.receiver_phone,
        address: form.address, note: form.note, status: form.status,
      };
      if (editingId) { await crudApi.updateDelivery(editingId, payload); toast.success('แก้ไขแล้ว'); }
      else { await crudApi.createDelivery(payload); toast.success('สร้างรายการแล้ว'); }
      setShowModal(false); setReload(r => r + 1);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <MainLayout title="ทะเบียนการจัดส่งยา" subtitle="Medication Delivery Registry"
    >
      <DataTable cols={cols}
        fetcher={p => registryApi.getMedDelivery(p).then(r => r.data)}
        searchPlaceholder="ค้นหาผู้ป่วย, ผู้รับ..."
        emptyIcon={<Truck size={36} />} emptyText="ไม่พบรายการ"
        deps={[reload]}
        onAdd={openAdd} addLabel="เพิ่มรายการ"
        onRowClick={row => setDrawer(row)}
        actionCol={row => (
          <RowActions onView={() => setDrawer(row)} onEdit={() => openEdit(row)}
            onDelete={async () => { await crudApi.deleteDelivery(row.delivery_id); setReload(r => r + 1); }} />
        )}
        deleteConfirmText={row => `ลบรายการจัดส่งของ "${row.patient_name}"?`}
      />

      <CrudModal open={showModal} onClose={() => setShowModal(false)}
        title="การจัดส่งยา" editingId={editingId} onSave={handleSave} saving={saving}>
        <FormGrid>
          <div className="sm:col-span-2">
            <SearchSelect type="patient" label="ผู้ป่วย" required initialDisplay={form.patient_label} resetKey={resetKey}
              onSelect={p => { f('patient_id', p?.patient_id ?? 0); f('patient_label', p?.full_name ?? ''); clearErr('patient_id'); }} disabled={!!editingId} />
            {errors.patient_id && <p className="mt-1 text-xs text-red-500">{errors.patient_id}</p>}
          </div>
          <div>
            <Select label="วิธีจัดส่ง" required value={form.delivery_method}
              onChange={e => { f('delivery_method', e.target.value); clearErr('delivery_method'); }}
              placeholder="เลือกวิธี" options={['ไปรษณีย์', 'Messenger', 'มารับด้วยตนเอง', 'จัดส่งถึงบ้าน'].map(m => ({ value: m, label: m }))}
              error={errors.delivery_method} />
          </div>
          {editingId && <Select label="สถานะ" value={form.status} onChange={e => f('status', e.target.value)}
            options={Object.entries(STATUS_MAP).map(([v, { label }]) => ({ value: v, label }))} />}
          <Input label="ชื่อผู้รับ" required value={form.receiver_name}
            onChange={e => { f('receiver_name', e.target.value); clearErr('receiver_name'); }}
            error={errors.receiver_name} />
          <Input label="เบอร์โทร" required value={form.receiver_phone}
            onChange={e => { f('receiver_phone', e.target.value); clearErr('receiver_phone'); }}
            error={errors.receiver_phone} />
          <div className="sm:col-span-2">
            <Textarea label="ที่อยู่จัดส่ง" required value={form.address}
              onChange={e => { f('address', e.target.value); clearErr('address'); }}
              rows={2} error={errors.address} />
          </div>
          <div className="sm:col-span-2">
            <Textarea label="หมายเหตุ" value={form.note} onChange={e => f('note', e.target.value)} rows={2} />
          </div>
        </FormGrid>
      </CrudModal>

      <RegistryDrawer
        open={!!drawer} onClose={() => setDrawer(null)} row={drawer}
        title="การจัดส่งยา" subtitle={r => r.patient_name}
        onEdit={openEdit}
        fields={[
          { label: 'ผู้ป่วย', key: '_patient', type: 'patient' },
          { label: 'สถานะ', key: 'status', type: 'badge_status', statusMap: STATUS_MAP },
          { label: 'วิธีจัดส่ง', key: 'delivery_method' },
          { label: 'วันที่', key: 'delivery_date', type: 'date' },
          { label: 'ผู้รับ', key: 'receiver_name' },
          { label: 'เบอร์โทร', key: 'receiver_phone' },
          { label: 'ที่อยู่',    key: 'address',          span: true },
          { label: 'หมายเหตุ',  key: 'note',              span: true },
        ]}
      />
    </MainLayout>
  );
}
