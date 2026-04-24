'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { CrudModal, FormGrid, RowActions } from '@/components/CrudModal';
import { Input, Select, Textarea, Badge } from '@/components/ui';
import SearchSelect from '@/components/SearchSelect';
import RegistryDrawer from '@/components/RegistryDrawer';
import { registryApi, crudApi } from '@/lib/api';
import { Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtDate } from '@/lib/dateUtils';

const STATUS_MAP = {
  Pending:    { label: 'รอดำเนินการ', variant: 'warning' as const },
  Processing: { label: 'กำลังส่ง',    variant: 'info'    as const },
  Delivered:  { label: 'ส่งแล้ว',     variant: 'success' as const },
  Cancelled:  { label: 'ยกเลิก',      variant: 'danger'  as const },
};

const emptyForm = {
  patient_id: 0, patient_label: '', delivery_method: '',
  receiver_name: '', receiver_phone: '', address: '', note: '', status: 'Pending',
};

const cols: ColDef[] = [
  { key: 'patient_name', label: 'ผู้ป่วย',
    render: r => <><p className="font-medium">{r.patient_name}</p><p className="text-xs text-slate-400">{r.hn_number}</p></> },
  { key: 'receiver_name',  label: 'ผู้รับ',   className: 'text-sm' },
  { key: 'receiver_phone', label: 'โทร',      className: 'text-xs font-mono' },
  { key: 'delivery_method',label: 'วิธีส่ง',  className: 'text-xs' },
  { key: 'status', label: 'สถานะ',
    render: r => { const c = STATUS_MAP[r.status as keyof typeof STATUS_MAP] ?? {label:r.status,variant:'gray' as const}; return <Badge variant={c.variant}>{c.label}</Badge>; } },
  { key: 'delivery_date', label: 'วันที่',
    render: r => fmtDate(r.delivery_date) },
];

export default function DeliveryPage() {
  const [form,      setForm]      = useState<typeof emptyForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [reload,    setReload]    = useState(0);
  const [resetKey,  setResetKey]  = useState(0);
  const [drawer,    setDrawer]    = useState<any | null>(null);
  const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const openEdit = (row: any) => {
    setForm({ patient_id: row.patient_id, patient_label: row.patient_name||'',
      delivery_method: row.delivery_method||'', receiver_name: row.receiver_name||'',
      receiver_phone: row.receiver_phone||'', address: row.address||'',
      note: row.note||'', status: row.status||'Pending' });
    setEditingId(row.delivery_id); setResetKey(k=>k+1); setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.patient_id)      { toast.error('กรุณาเลือกผู้ป่วย');     return; }
    if (!form.delivery_method) { toast.error('กรุณาเลือกวิธีจัดส่ง');  return; }
    if (!form.receiver_name)   { toast.error('กรุณากรอกชื่อผู้รับ');    return; }
    if (!form.receiver_phone)  { toast.error('กรุณากรอกเบอร์โทร');      return; }
    if (!form.address)         { toast.error('กรุณากรอกที่อยู่');        return; }
    setSaving(true);
    try {
      const payload = { patient_id: form.patient_id, delivery_method: form.delivery_method,
        receiver_name: form.receiver_name, receiver_phone: form.receiver_phone,
        address: form.address, note: form.note, status: form.status };
      if (editingId) { await crudApi.updateDelivery(editingId, payload); toast.success('แก้ไขแล้ว'); }
      else           { await crudApi.createDelivery(payload);            toast.success('สร้างรายการแล้ว'); }
      setShowModal(false); setReload(r=>r+1);
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
        onRowClick={row => setDrawer(row)}
        actionCol={row => (
          <RowActions onView={() => setDrawer(row)} onEdit={() => openEdit(row)}
            onDelete={async () => { await crudApi.deleteDelivery(row.delivery_id); setReload(r=>r+1); }} />
        )}
        deleteConfirmText={row => `ลบรายการจัดส่งของ "${row.patient_name}"?`}
      />

      <CrudModal open={showModal} onClose={() => setShowModal(false)}
        title="การจัดส่งยา" editingId={editingId} onSave={handleSave} saving={saving}>
        <FormGrid>
          <div className="sm:col-span-2">
            <SearchSelect type="patient" label="ผู้ป่วย" required initialDisplay={form.patient_label} resetKey={resetKey}
              onSelect={p => { f('patient_id', p?.patient_id??0); f('patient_label', p?.full_name??''); }} disabled={!!editingId} />
          </div>
          <Select label="วิธีจัดส่ง" required value={form.delivery_method} onChange={e => f('delivery_method', e.target.value)}
            placeholder="เลือกวิธี" options={['ไปรษณีย์','Messenger','มารับด้วยตนเอง','จัดส่งถึงบ้าน'].map(m=>({value:m,label:m}))} />
          {editingId && <Select label="สถานะ" value={form.status} onChange={e => f('status', e.target.value)}
            options={Object.entries(STATUS_MAP).map(([v,{label}])=>({value:v,label}))} />}
          <Input label="ชื่อผู้รับ" required value={form.receiver_name} onChange={e => f('receiver_name', e.target.value)} />
          <Input label="เบอร์โทร" required value={form.receiver_phone} onChange={e => f('receiver_phone', e.target.value)} />
          <div className="sm:col-span-2">
            <Textarea label="ที่อยู่จัดส่ง" required value={form.address} onChange={e => f('address', e.target.value)} rows={2} />
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
          { label: 'ผู้ป่วย',      key: '_patient', type: 'patient' },
          { label: 'วิธีจัดส่ง',  key: 'delivery_method' },
          { label: 'ผู้รับ',       key: 'receiver_name' },
          { label: 'เบอร์โทร',    key: 'receiver_phone' },
          { label: 'สถานะ',       key: 'status', type: 'badge_status', statusMap: STATUS_MAP },
          { label: 'วันที่',       key: 'delivery_date', type: 'date' },
          { label: 'ที่อยู่',      key: 'address', span: true },
          { label: 'หมายเหตุ',    key: 'note', span: true },
        ]}
      />
    </MainLayout>
  );
}
