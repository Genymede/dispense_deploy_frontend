'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { CrudModal, FormGrid, FormSection, RowActions } from '@/components/CrudModal';
import { Input, Select, Textarea, Badge, Button } from '@/components/ui';
import SearchSelect from '@/components/SearchSelect';
import DetailDrawer, { DrawerSection, DrawerGrid } from '@/components/DetailDrawer';
import { registryApi, crudApi } from '@/lib/api';
import { phone as validatePhone } from '@/lib/validate';
import { Truck, Pill, Edit2 } from 'lucide-react';
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
    key: 'patient_name', label: 'ผู้ป่วย',
    render: r => <><p className="font-medium">{r.patient_name}</p><p className="text-xs text-slate-400">{r.hn_number}</p></>
  },
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
        onRowClick={row => setDrawer(row)}
        actionCol={row => (
          <RowActions onView={() => setDrawer(row)} onEdit={() => openEdit(row)}
            onDelete={async () => { await crudApi.deleteDelivery(row.delivery_id); setReload(r => r + 1); }} />
        )}
        deleteConfirmText={row => `ลบรายการจัดส่งของ "${row.patient_name}"?`}
      />

      <CrudModal open={showModal} onClose={() => setShowModal(false)}
        title="การจัดส่งยา" editingId={editingId} onSave={handleSave} saving={saving}>
        <div className="flex flex-col gap-4">
          <FormSection title="ข้อมูลผู้ป่วย" cols={1}>
            <div>
              <SearchSelect type="patient" label="ผู้ป่วย" required initialDisplay={form.patient_label} resetKey={resetKey}
                onSelect={p => { f('patient_id', p?.patient_id ?? 0); f('patient_label', p?.full_name ?? ''); clearErr('patient_id'); }} disabled={!!editingId} />
              {errors.patient_id && <p className="mt-1 text-xs text-red-500">{errors.patient_id}</p>}
            </div>
          </FormSection>
          <FormSection title="รายละเอียดการจัดส่ง">
            <Select label="วิธีจัดส่ง" required value={form.delivery_method}
              onChange={e => { f('delivery_method', e.target.value); clearErr('delivery_method'); }}
              placeholder="เลือกวิธี" options={['ไปรษณีย์', 'Messenger', 'มารับด้วยตนเอง', 'จัดส่งถึงบ้าน'].map(m => ({ value: m, label: m }))}
              error={errors.delivery_method} />
            {editingId
              ? <Select label="สถานะ" value={form.status} onChange={e => f('status', e.target.value)}
                  options={Object.entries(STATUS_MAP).map(([v, { label }]) => ({ value: v, label }))} />
              : <div />}
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
          </FormSection>
        </div>
      </CrudModal>

      <DetailDrawer
        open={!!drawer} onClose={() => setDrawer(null)}
        title={drawer ? `การจัดส่ง — ${drawer.patient_name}` : ''}
        subtitle={drawer ? `HN: ${drawer.hn_number || '—'}` : ''}
        width="md"
      >
        {drawer && (
          <>
            <DrawerSection title="ข้อมูลการจัดส่ง">
              <DrawerGrid items={[
                { label: 'สถานะ',            value: <Badge variant={(STATUS_MAP[drawer.status as keyof typeof STATUS_MAP] ?? { variant: 'gray' }).variant}>{(STATUS_MAP[drawer.status as keyof typeof STATUS_MAP] ?? { label: drawer.status }).label}</Badge> },
                { label: 'วันที่จัดส่ง',     value: fmtDate(drawer.delivery_date) },
                { label: 'วันที่รับยา',       value: drawer.delivered_at ? fmtDate(drawer.delivered_at, true) : '—' },
                { label: 'วิธีจัดส่ง',        value: drawer.delivery_method || '—' },
                { label: 'เลขพัสดุ',          value: drawer.tracking_number || '—' },
                { label: 'ผู้จัดส่ง',         value: drawer.courier_name || '—' },
                { label: 'เบอร์โทรผู้จัดส่ง', value: drawer.courier_phone || '—' },
              ]} />
            </DrawerSection>

            <DrawerSection title="ข้อมูลผู้รับ">
              <DrawerGrid items={[
                { label: 'ผู้รับ',     value: drawer.receiver_name || '—' },
                { label: 'เบอร์โทร',   value: drawer.receiver_phone || '—' },
                { label: 'ที่อยู่',    value: drawer.address || '—', span: true },
              ]} />
            </DrawerSection>

            {Array.isArray(drawer.medicine_list) && drawer.medicine_list.length > 0 && (
              <DrawerSection title={
                `รายการยา (${drawer.medicine_list.length} รายการ)` +
                (Number(drawer.total_cost) > 0 ? ` · ${Number(drawer.total_cost).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท` : '')
              }>
                <div className="overflow-x-auto -mx-1 rounded-xl border border-slate-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 w-7">#</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400">ชื่อยา / วิธีใช้</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-400 whitespace-nowrap">จำนวน</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-400 whitespace-nowrap">ราคา (บาท)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {drawer.medicine_list.map((m: any, i: number) => {
                        const mealStr = m.meal_sessions ? m.meal_sessions.split(',').filter(Boolean).join(' ') : '';
                        const usage = [m.route, m.dose_qty ? `ครั้งละ ${m.dose_qty} ${m.dose_unit || ''}` : '', m.frequency, m.meal_relation, mealStr].filter(Boolean).join('  ');
                        return (
                          <tr key={i}>
                            <td className="px-3 py-3 text-xs text-slate-300 text-center align-top">{i + 1}</td>
                            <td className="px-3 py-3">
                              <p className="font-semibold text-slate-800 leading-snug">{m.med_showname || m.med_name}</p>
                              {usage && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{usage}</p>}
                            </td>
                            <td className="px-3 py-3 text-center align-top whitespace-nowrap">
                              <span className="font-semibold text-slate-700">{m.quantity}</span>
                              <span className="text-xs text-slate-400 ml-1">{m.unit || ''}</span>
                            </td>
                            <td className="px-3 py-3 text-right align-top whitespace-nowrap">
                              {Number(m.unit_price) > 0 ? (
                                <div>
                                  <p className="font-semibold text-slate-700">{(Number(m.unit_price) * m.quantity).toFixed(2)}</p>
                                  <p className="text-xs text-slate-400">{Number(m.unit_price).toFixed(2)} × {m.quantity}</p>
                                </div>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </DrawerSection>
            )}

            {drawer.note && (
              <DrawerSection title="หมายเหตุ">
                <p className="text-sm text-slate-600">{drawer.note}</p>
              </DrawerSection>
            )}

            <DrawerSection title="">
              <Button variant="secondary" size="sm" icon={<Edit2 size={14} />} onClick={() => { setDrawer(null); openEdit(drawer); }}>แก้ไข</Button>
            </DrawerSection>
          </>
        )}
      </DetailDrawer>
    </MainLayout>
  );
}
