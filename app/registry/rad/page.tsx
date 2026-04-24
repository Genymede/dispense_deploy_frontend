'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef, StatusBadge } from '@/components/DataTable';
import { CrudModal, FormGrid, RowActions } from '@/components/CrudModal';
import { Input, Select, Textarea, Button } from '@/components/ui';
import SearchSelect from '@/components/SearchSelect';
import RegistryDrawer from '@/components/RegistryDrawer';
import { radApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate } from '@/lib/dateUtils';
import { FileWarning, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_MAP = {
  pending:   { label: 'รอดำเนินการ', variant: 'warning' as const },
  approved:  { label: 'อนุมัติ',     variant: 'success' as const },
  rejected:  { label: 'ปฏิเสธ',      variant: 'danger'  as const },
  dispensed: { label: 'จ่ายแล้ว',    variant: 'info'    as const },
  cancelled: { label: 'ยกเลิก',      variant: 'gray'    as const },
};

const CULTURE_OPTIONS = [
  { value: 'not_done',  label: 'ยังไม่ได้ส่ง' },
  { value: 'pending',   label: 'รอผล' },
  { value: 'positive',  label: 'พบเชื้อ' },
  { value: 'negative',  label: 'ไม่พบเชื้อ' },
];

const emptyForm = {
  med_id: 0, med_label: '',
  quantity: '', unit: 'เม็ด',
  patient_id: 0, patient_label: '',
  ward: '',
  diagnosis: '',
  infection_site: '',
  clinical_indication: '',
  culture_result: 'not_done',
  duration_days: '',
  prescriber_name: '',
  requested_by: '', req_label: '',
  approved_by: '', appr_label: '',
  status: 'pending',
  note: '',
};

const cols: ColDef[] = [
  { key: 'med_name',          label: 'ยาปฏิชีวนะ',  render: r => <><p className="font-medium">{r.med_name}</p><p className="text-xs text-slate-400">{r.med_generic_name}</p></> },
  { key: 'patient_name',      label: 'ผู้ป่วย',      className: 'text-xs' },
  { key: 'diagnosis',         label: 'การวินิจฉัย',  className: 'text-xs text-slate-600 max-w-[160px] truncate' },
  { key: 'quantity',          label: 'จำนวน',        render: r => <span className="font-semibold">{r.quantity} {r.unit}</span> },
  { key: 'requested_by_name', label: 'ผู้ขอ',        className: 'text-xs' },
  { key: 'status',            label: 'สถานะ',        render: r => <StatusBadge status={r.status} map={STATUS_MAP} /> },
  { key: 'request_time',      label: 'วันที่',        render: r => fmtDate(r.request_time) },
];

export default function RadPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [row, setRow] = useState<any>(null);
  const [confirm, setConfirm] = useState<{ type: 'approve' | 'reject'; row: any } | null>(null);
  const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const openAdd = () => {
    setForm({ ...emptyForm, requested_by: user?.id ?? '', req_label: user?.email ?? '' });
    setEditId(null); setResetKey(k => k + 1); setShowModal(true);
  };

  const openEdit = (r: any) => {
    setForm({
      med_id: r.med_id, med_label: r.med_name || '',
      quantity: String(r.quantity), unit: r.unit || 'เม็ด',
      patient_id: r.patient_id || 0, patient_label: r.patient_name || '',
      ward: r.ward || '',
      diagnosis: r.diagnosis || '',
      infection_site: r.infection_site || '',
      clinical_indication: r.clinical_indication || '',
      culture_result: r.culture_result || 'not_done',
      duration_days: r.duration_days ? String(r.duration_days) : '',
      prescriber_name: r.prescriber_name || '',
      requested_by: r.requested_by || '', req_label: r.requested_by_name || '',
      approved_by: r.approved_by || '', appr_label: r.approved_by_name || '',
      status: r.status,
      note: r.note || '',
    });
    setEditId(r.rad_id); setResetKey(k => k + 1); setShowModal(true);
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    const { type, row: r } = confirm;
    setConfirm(null);
    try {
      if (type === 'approve') {
        await radApi.approve(r.rad_id, user?.id ?? '');
        toast.success('อนุมัติแล้ว');
      } else {
        await radApi.reject(r.rad_id, user?.id ?? '');
        toast.success('ปฏิเสธคำขอแล้ว');
      }
      setReload(n => n + 1);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleSave = async () => {
    if (!form.med_id)                { toast.error('กรุณาเลือกยา');                return; }
    if (!form.quantity)              { toast.error('กรุณากรอกจำนวน');              return; }
    if (!form.diagnosis)             { toast.error('กรุณากรอกการวินิจฉัย');        return; }
    if (!form.clinical_indication)   { toast.error('กรุณากรอกเหตุผลทางคลินิก');   return; }
    if (!form.requested_by)           { toast.error('กรุณาเลือกผู้ขอ');             return; }
    setSaving(true);
    try {
      const payload = {
        med_id: form.med_id,
        quantity: Number(form.quantity),
        unit: form.unit,
        patient_id: form.patient_id || undefined,
        ward: form.ward || undefined,
        diagnosis: form.diagnosis,
        infection_site: form.infection_site || undefined,
        clinical_indication: form.clinical_indication,
        culture_result: form.culture_result,
        duration_days: form.duration_days ? Number(form.duration_days) : undefined,
        prescriber_name: form.prescriber_name || undefined,
        requested_by: form.requested_by,
        approved_by: form.approved_by || undefined,
        note: form.note || undefined,
        ...(editId ? { status: form.status } : {}),
      };
      if (editId) { await radApi.update(editId, payload); toast.success('แก้ไขเรียบร้อย'); }
      else        { await radApi.create(payload);          toast.success('สร้างใบขอ RAD เรียบร้อย'); }
      setShowModal(false); setReload(r => r + 1);
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <MainLayout title="RAD Registry" subtitle="ทะเบียนคำขอใช้ยาปฏิชีวนะควบคุม">
      <DataTable cols={cols}
        fetcher={p => radApi.getAll(p).then(r => r.data)}
        filters={[
          { key: 'status', type: 'select', placeholder: 'ทุกสถานะ',
            options: Object.entries(STATUS_MAP).map(([v, { label }]) => ({ value: v, label })) },
        ]}
        searchPlaceholder="ค้นหาชื่อยา, ผู้ป่วย, การวินิจฉัย..."
        emptyIcon={<FileWarning size={36} />} emptyText="ไม่พบรายการ"
        deps={[reload]} onRowClick={r => setRow(r)} onAdd={openAdd} addLabel="สร้างใบขอ RAD"
        actionCol={r => (
          <div className="flex items-center justify-end gap-1">
            <RowActions
              onView={() => setRow(r)}
              onEdit={() => openEdit(r)}
              onDelete={['pending', 'cancelled'].includes(r.status)
                ? async () => { await radApi.remove(r.rad_id); setReload(n => n + 1); }
                : undefined}
              canDelete={['pending', 'cancelled'].includes(r.status)}
            />
            {r.status === 'pending' && (<>
              <button onClick={e => { e.stopPropagation(); setConfirm({ type: 'approve', row: r }); }}
                className="px-2 py-1 rounded text-xs bg-green-50 text-green-700 hover:bg-green-100 font-medium flex items-center gap-1">
                <CheckCircle size={12} /> อนุมัติ
              </button>
              <button onClick={e => { e.stopPropagation(); setConfirm({ type: 'reject', row: r }); }}
                className="px-2 py-1 rounded text-xs bg-red-50 text-red-700 hover:bg-red-100 font-medium flex items-center gap-1">
                <XCircle size={12} /> ปฏิเสธ
              </button>
            </>)}
          </div>
        )}
        deleteConfirmText={r => `ลบใบขอ RAD "${r.med_name}"?`}
      />

      <CrudModal open={showModal} onClose={() => setShowModal(false)}
        title="ใบขอใช้ยาปฏิชีวนะควบคุม (RAD)"
        editingId={editId} onSave={handleSave} saving={saving}>
        <FormGrid>
          {/* ยา */}
          <div className="sm:col-span-2">
            <SearchSelect type="drug" label="ยาปฏิชีวนะที่ต้องการ" required
              initialDisplay={form.med_label} resetKey={resetKey}
              onSelect={d => { f('med_id', d?.med_id ?? 0); f('med_label', d?.med_name ?? ''); }} />
          </div>
          <Input label="จำนวน" required type="number" min="1"
            value={form.quantity} onChange={e => f('quantity', e.target.value)} />
          <Input label="หน่วย" required
            value={form.unit} onChange={e => f('unit', e.target.value)} />

          {/* ผู้ป่วย */}
          <SearchSelect type="patient" label="ผู้ป่วย"
            initialDisplay={form.patient_label} resetKey={resetKey}
            onSelect={p => { f('patient_id', p?.patient_id ?? 0); f('patient_label', p?.full_name ?? ''); }} />
          <Input label="Ward / แผนก"
            value={form.ward} onChange={e => f('ward', e.target.value)} />

          {/* ข้อมูลทางคลินิก */}
          <div className="sm:col-span-2">
            <Input label="การวินิจฉัย" required
              value={form.diagnosis} onChange={e => f('diagnosis', e.target.value)}
              placeholder="เช่น Pneumonia, UTI, Sepsis" />
          </div>
          <Input label="ตำแหน่งที่ติดเชื้อ"
            value={form.infection_site} onChange={e => f('infection_site', e.target.value)}
            placeholder="เช่น Respiratory, Urinary, Blood" />
          <Select label="ผล Culture" value={form.culture_result}
            onChange={e => f('culture_result', e.target.value)}
            options={CULTURE_OPTIONS} />
          <div className="sm:col-span-2">
            <Textarea label="เหตุผลทางคลินิก" required rows={2}
              value={form.clinical_indication} onChange={e => f('clinical_indication', e.target.value)}
              placeholder="ระบุเหตุผลที่จำเป็นต้องใช้ยาปฏิชีวนะควบคุมนี้" />
          </div>
          <Input label="ระยะเวลาที่ใช้ยา (วัน)" type="number" min="1"
            value={form.duration_days} onChange={e => f('duration_days', e.target.value)} />
          <Input label="แพทย์ผู้สั่ง"
            value={form.prescriber_name} onChange={e => f('prescriber_name', e.target.value)} />

          {/* บุคลากร */}
          <SearchSelect type="user" label="ผู้ขอ" required
            initialDisplay={form.req_label} resetKey={resetKey}
            onSelect={u => { f('requested_by', u?.id ?? ''); f('req_label', u?.full_name ?? u?.email ?? ''); }} />
          {editId ? (
            <>
              <SearchSelect type="user" label="ผู้อนุมัติ"
                initialDisplay={form.appr_label} resetKey={resetKey}
                onSelect={u => { f('approved_by', u?.id ?? ''); f('appr_label', u?.full_name ?? u?.email ?? ''); }} />
              <Select label="สถานะ" value={form.status}
                onChange={e => f('status', e.target.value)}
                options={Object.entries(STATUS_MAP).map(([v, { label }]) => ({ value: v, label }))} />
            </>
          ) : null}

          <div className="sm:col-span-2">
            <Textarea label="หมายเหตุ" rows={2}
              value={form.note} onChange={e => f('note', e.target.value)} />
          </div>
        </FormGrid>
      </CrudModal>

      <RegistryDrawer
        open={!!row} onClose={() => setRow(null)} row={row}
        title={r => `RAD: ${r.med_name}`}
        subtitle={r => STATUS_MAP[r.status as keyof typeof STATUS_MAP]?.label ?? r.status}
        onEdit={openEdit}
        extraActions={r => r.status === 'pending' ? (
          <div className="flex gap-2">
            <Button onClick={() => { setRow(null); setConfirm({ type: 'approve', row: r }); }}>อนุมัติ</Button>
            <Button variant="danger" onClick={() => { setRow(null); setConfirm({ type: 'reject', row: r }); }}>ปฏิเสธ</Button>
          </div>
        ) : null}
        fields={[
          { label: 'ยาปฏิชีวนะ',       key: '_drug',               type: 'drug',         span: true },
          { label: 'จำนวน',             key: 'quantity',            type: 'template',     template: r => `${r.quantity} ${r.unit || ''}` },
          { label: 'สถานะ',             key: 'status',              type: 'badge_status', statusMap: STATUS_MAP },
          { label: 'ผู้ป่วย',           key: 'patient_name' },
          { label: 'Ward',              key: 'ward' },
          { label: 'การวินิจฉัย',       key: 'diagnosis',           span: true },
          { label: 'ตำแหน่งติดเชื้อ',  key: 'infection_site' },
          { label: 'ผล Culture',        key: 'culture_result',      type: 'template',     template: r => CULTURE_OPTIONS.find(o => o.value === r.culture_result)?.label ?? r.culture_result },
          { label: 'เหตุผลทางคลินิก',  key: 'clinical_indication', span: true },
          { label: 'ระยะเวลา (วัน)',    key: 'duration_days' },
          { label: 'แพทย์ผู้สั่ง',      key: 'prescriber_name' },
          { label: 'ผู้ขอ',             key: 'requested_by_name' },
          { label: 'ผู้อนุมัติ',        key: 'approved_by_name' },
          { label: 'วันที่ขอ',          key: 'request_time',        type: 'datetime',     span: true },
          { label: 'หมายเหตุ',          key: 'note',                span: true },
        ]}
      />
      {/* Confirm Dialog */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className={`flex items-center gap-3 mb-3 ${confirm.type === 'approve' ? 'text-green-600' : 'text-red-600'}`}>
              {confirm.type === 'approve'
                ? <CheckCircle size={24} />
                : <XCircle size={24} />}
              <h3 className="font-bold text-base text-slate-800">
                {confirm.type === 'approve' ? 'ยืนยันการอนุมัติ' : 'ยืนยันการปฏิเสธ'}
              </h3>
            </div>
            <p className="text-sm text-slate-600 mb-1">
              คุณต้องการ{' '}
              {confirm.type === 'approve'
                ? <span className="font-semibold text-green-700">อนุมัติ</span>
                : <span className="font-semibold text-red-700">ปฏิเสธ</span>}{' '}
              คำขอนี้?
            </p>
            <p className="text-sm text-slate-600 mb-5">
              ยา <span className="font-semibold">{confirm.row.med_name}</span>
              {confirm.row.patient_name ? <> — ผู้ป่วย <span className="font-semibold">{confirm.row.patient_name}</span></> : null}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50">
                ยกเลิก
              </button>
              <button onClick={handleConfirm}
                className={`px-4 py-2 rounded-lg text-sm font-semibold text-white ${confirm.type === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                {confirm.type === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
