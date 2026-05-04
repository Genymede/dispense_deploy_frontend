'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef, ExportButtons } from '@/components/DataTable';
import { CrudModal, FormGrid, RowActions } from '@/components/CrudModal';
import { Input, Select, Textarea, Badge, Button, Spinner } from '@/components/ui';
import SearchSelect from '@/components/SearchSelect';
import DetailDrawer, { DrawerSection, DrawerGrid } from '@/components/DetailDrawer';
import PatientDrawer from '@/components/PatientDrawer';
import { registryApi, crudApi, drugApi, type Drug } from '@/lib/api';
import { validateDrugLots } from '@/lib/drugUtils';
import { Truck, Pill, X, AlertTriangle, Search, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtDate } from '@/lib/dateUtils';

const STATUS_MAP = {
  Pending: { label: 'รอดำเนินการ', variant: 'warning' as const },
  Processing: { label: 'กำลังส่ง', variant: 'info' as const },
  Delivered: { label: 'ส่งแล้ว', variant: 'success' as const },
  Cancelled: { label: 'ยกเลิก', variant: 'danger' as const },
};

interface MedItem {
  med_sid: number;
  med_id: number;
  med_name: string;
  med_showname: string;
  quantity: number;
  unit: string;
  stock: number;
  unit_price: number;
}

const emptyForm = {
  patient_id: 0, patient_label: '',
  delivery_method: '', receiver_name: '', receiver_phone: '',
  address: '', note: '', status: 'Pending',
  medicine_list: [] as MedItem[],
  courier_name: '', courier_phone: '', tracking_number: '',
};

const cols: ColDef[] = [
  {
    key: 'patient_name', label: 'ผู้ป่วย',
    render: r => <><p className="font-medium">{r.patient_name}</p><p className="text-xs text-slate-400">{r.hn_number}</p></>
  },
  { key: 'receiver_name', label: 'ผู้รับ', className: 'text-sm' },
  { key: 'receiver_phone', label: 'โทรผู้รับ', className: 'text-xs font-mono' },
  { key: 'delivery_method', label: 'วิธีส่ง', className: 'text-xs' },
  {
    key: 'courier_name', label: 'ผู้จัดส่ง', className: 'text-sm',
    render: (r: any) => r.courier_name || <span className="text-slate-300">—</span>
  },
  {
    key: 'status', label: 'สถานะ',
    render: r => { const c = STATUS_MAP[r.status as keyof typeof STATUS_MAP] ?? { label: r.status, variant: 'gray' as const }; return <Badge variant={c.variant}>{c.label}</Badge>; }
  },
  {
    key: 'delivery_date', label: 'วันที่',
    render: r => fmtDate(r.delivery_date)
  },
  {
    key: 'total_cost', label: 'ยอดรวม',
    render: r => Number(r.total_cost) > 0
      ? <span className="text-sm font-medium text-slate-700">{Number(r.total_cost).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</span>
      : <span className="text-slate-300">—</span>,
    exportValue: r => Number(r.total_cost) > 0 ? `${Number(r.total_cost).toFixed(2)}` : '-'
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
  const [patientDrawerId, setPatientDrawerId] = useState<number | null>(null);
  const [drawerAllergies, setDrawerAllergies] = useState<any[]>([]);
  const [drawerAllergyLoading, setDrawerAllergyLoading] = useState(false);

  // drug search state
  const [drugSearch, setDrugSearch] = useState('');
  const [drugResults, setDrugResults] = useState<Drug[]>([]);
  const [drugLoading, setDrugLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [patientAllergies, setPatientAllergies] = useState<number[]>([]); // med_id list

  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  // โหลดประวัติแพ้ยาเมื่อ drawer เปิด
  useEffect(() => {
    if (!drawer?.patient_id) { setDrawerAllergies([]); return; }
    setDrawerAllergyLoading(true);
    registryApi.getAllergy({ patient_id: drawer.patient_id, limit: 200 } as any)
      .then((res: any) => setDrawerAllergies(res.data.data ?? []))
      .catch(() => setDrawerAllergies([]))
      .finally(() => setDrawerAllergyLoading(false));
  }, [drawer?.patient_id]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced drug search
  useEffect(() => {
    if (!drugSearch.trim()) { setDrugResults([]); setShowDropdown(false); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setDrugLoading(true);
      try {
        const res = await drugApi.getAll({ search: drugSearch, limit: 15, offset: 0 });
        setDrugResults(res.data.data);
        setShowDropdown(true);
      } catch { setDrugResults([]); }
      finally { setDrugLoading(false); }
    }, 300);
  }, [drugSearch]);

  // Load patient allergies when patient changes
  const loadAllergies = useCallback(async (patient_id: number) => {
    if (!patient_id) { setPatientAllergies([]); return; }
    try {
      const res = await registryApi.getAllergy({ patient_id, limit: 200 } as any);
      setPatientAllergies(res.data.data.map((a: any) => a.med_id));
    } catch { setPatientAllergies([]); }
  }, []);

  const handleSelectPatient = (patient: any) => {
    if (!patient) { f('patient_id', 0); f('patient_label', ''); setPatientAllergies([]); return; }
    const address = [
      patient.house_number ?? '',
      patient.village_number ? `หมู่ ${patient.village_number}` : '',
      patient.road ? `ถนน${patient.road}` : '',
      patient.sub_district ? `ต.${patient.sub_district}` : '',
      patient.district ? `อ.${patient.district}` : '',
      patient.province ? `จ.${patient.province}` : '',
      patient.postal_code ?? '',
    ].filter(Boolean).join(' ');
    setForm(p => ({
      ...p,
      patient_id: patient.patient_id ?? 0,
      patient_label: patient.full_name ?? '',
      receiver_name: patient.full_name || '',
      receiver_phone: patient.phone || '',
      address: address,
    }));
    loadAllergies(patient.patient_id);
  };

  const addDrug = async (drug: Drug) => {
    setShowDropdown(false);
    setDrugSearch('');

    // allergy check
    if (patientAllergies.includes(drug.med_id)) {
      toast.error(`⚠️ ผู้ป่วยแพ้ยา "${drug.med_showname || drug.med_name}" กรุณาตรวจสอบก่อนเพิ่ม`, { duration: 5000 });
      return;
    }

    // interaction check
    const existingIds = form.medicine_list.map(m => m.med_id);
    if (existingIds.length > 0) {
      try {
        const detail = await registryApi.getDrugById(drug.med_id);
        const conflicts = (detail.data.interactions || []).filter(
          (i: any) => existingIds.includes(i.med_id_2) && i.interaction_type !== 'compatible'
        );
        if (conflicts.length > 0) {
          const names = conflicts.map((i: any) => i.interacts_with_name).join(', ');
          toast(`⚠️ พบปฏิกิริยากับ: ${names} — เพิ่มต่อหรือไม่?`, { icon: '⚠️', duration: 6000 });
          // Continue adding (warn only, not block like old page)
        }
      } catch { /* ignore */ }
    }

    // already in list?
    if (form.medicine_list.some(m => m.med_sid === drug.med_sid)) {
      toast.error('ยานี้อยู่ในรายการแล้ว');
      return;
    }

    // ตรวจสอบล็อตยาและวันหมดอายุ (FEFO)
    const { ok } = await validateDrugLots(drug.med_sid, drug.med_showname || drug.med_name);
    if (!ok) return;

    const item: MedItem = {
      med_sid: drug.med_sid,
      med_id: drug.med_id,
      med_name: drug.med_name || '',
      med_showname: drug.med_showname || drug.med_name || '',
      quantity: 1,
      unit: drug.unit || '',
      stock: drug.current_stock ?? 0,
      unit_price: drug.unit_price ?? 0,
    };
    setForm(p => ({ ...p, medicine_list: [...p.medicine_list, item] }));
  };

  const removeDrug = (med_sid: number) =>
    setForm(p => ({ ...p, medicine_list: p.medicine_list.filter(m => m.med_sid !== med_sid) }));

  const changeQty = (med_sid: number, qty: number) => {
    const item = form.medicine_list.find(m => m.med_sid === med_sid);
    if (item && qty > item.stock) { toast.error(`สต็อกมีเพียง ${item.stock} หน่วย`); return; }
    setForm(p => ({ ...p, medicine_list: p.medicine_list.map(m => m.med_sid === med_sid ? { ...m, quantity: Math.max(1, qty) } : m) }));
  };

  const openAdd = () => {
    setForm(emptyForm); setEditingId(null); setResetKey(k => k + 1);
    setDrugSearch(''); setDrugResults([]); setPatientAllergies([]);
    setShowModal(true);
  };

  const openEdit = (row: any) => {
    if (row.status === 'Delivered' || row.status === 'Cancelled') {
      toast.error('ไม่สามารถแก้ไขได้ สถานะสิ้นสุดแล้ว');
      return;
    }
    const medList: MedItem[] = Array.isArray(row.medicine_list) ? row.medicine_list : [];
    setForm({
      patient_id: row.patient_id || 0, patient_label: row.patient_name || '',
      delivery_method: row.delivery_method || '', receiver_name: row.receiver_name || '',
      receiver_phone: row.receiver_phone || '', address: row.address || '',
      note: row.note || '', status: row.status || 'Pending', medicine_list: medList,
      courier_name: row.courier_name || '', courier_phone: row.courier_phone || '',
      tracking_number: row.tracking_number || '',
    });
    setEditingId(row.delivery_id); setResetKey(k => k + 1);
    setDrugSearch(''); setDrugResults([]);
    loadAllergies(row.patient_id);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.patient_id) { toast.error('กรุณาเลือกผู้ป่วย'); return; }
    if (!form.delivery_method) { toast.error('กรุณาเลือกวิธีจัดส่ง'); return; }
    if (!form.receiver_name) { toast.error('กรุณากรอกชื่อผู้รับ'); return; }
    if (!form.receiver_phone) { toast.error('กรุณากรอกเบอร์โทร'); return; }
    if (!/^0\d{8,9}$/.test(form.receiver_phone.replace(/[-\s]/g, ''))) {
      toast.error('เบอร์โทรไม่ถูกต้อง (ตัวอย่าง: 0812345678)'); return;
    }
    if (!form.address) { toast.error('กรุณากรอกที่อยู่'); return; }
    if (!form.medicine_list || form.medicine_list.length === 0) { toast.error('กรุณาเพิ่มรายการยาอย่างน้อย 1 รายการ'); return; }

    setSaving(true);
    try {
      // ── ตรวจสอบล็อตยา (ข้ามล็อตหมดอายุตามเงื่อนไข FIFO/FEFO) ──
      const stockChecks = await Promise.all(form.medicine_list.map(async it => {
        const { ok, available } = await validateDrugLots(it.med_sid, it.med_showname || it.med_name, it.quantity, true);
        return { name: it.med_showname || it.med_name, required: it.quantity, available, ok };
      }));

      const invalidItem = stockChecks.find(c => !c.ok);
      if (invalidItem) {
        toast.error(`ไม่สามารถบันทึกได้: ยา "${invalidItem.name}" มีสต็อกที่ยังไม่หมดอายุเพียง ${invalidItem.available} (ต้องการ ${invalidItem.required})`, { duration: 5000 });
        setSaving(false);
        return;
      }

      const payload = {
        patient_id: form.patient_id, delivery_method: form.delivery_method,
        receiver_name: form.receiver_name, receiver_phone: form.receiver_phone,
        address: form.address, note: form.note, status: form.status,
        courier_name: form.courier_name || undefined,
        courier_phone: form.courier_phone || undefined,
        tracking_number: form.tracking_number || undefined,
        medicine_list: form.medicine_list.map(m => ({
          med_sid: m.med_sid, med_id: m.med_id, quantity: m.quantity,
          med_name: m.med_showname || m.med_name, unit_price: m.unit_price ?? 0,
        })),
      };
      if (editingId) { await crudApi.updateDelivery(editingId, payload); toast.success('แก้ไขแล้ว'); }
      else { await crudApi.createDelivery(payload); toast.success('สร้างรายการแล้ว'); }
      setShowModal(false); setReload(r => r + 1);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const statusBadge = (status: string) => {
    const c = STATUS_MAP[status as keyof typeof STATUS_MAP] ?? { label: status, variant: 'gray' as const };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  return (
    <MainLayout title="การจัดส่งยา" subtitle="Medication Delivery Management"
      actions={<ExportButtons report="med-delivery" />}>
      <DataTable cols={cols}
        fetcher={p => registryApi.getMedDelivery(p).then(r => r.data)}
        searchPlaceholder="ค้นหาผู้ป่วย, ผู้รับ..."
        emptyIcon={<Truck size={36} />} emptyText="ไม่พบรายการ"
        deps={[reload]} onAdd={openAdd} addLabel="สร้างรายการจัดส่ง"
        onRowClick={row => setDrawer(row)}
        actionCol={row => (
          <RowActions
            onView={() => setDrawer(row)}
            onEdit={() => openEdit(row)}
            onDelete={async () => {
              if (row.status === 'Delivered') {
                toast.error('ไม่สามารถลบรายการที่จัดส่งแล้ว');
                return;
              }
              await crudApi.deleteDelivery(row.delivery_id);
              setReload(r => r + 1);
            }}
          />
        )}
        deleteConfirmText={row => `ลบรายการจัดส่งของ "${row.patient_name}"?`}
      />

      {/* Create / Edit Modal */}
      <CrudModal open={showModal} onClose={() => setShowModal(false)}
        title="การจัดส่งยา" editingId={editingId} onSave={handleSave} saving={saving} size="lg">
        <FormGrid>
          {/* Patient */}
          <div className="sm:col-span-2">
            <SearchSelect type="patient" label="ผู้ป่วย" required
              initialDisplay={form.patient_label} resetKey={resetKey}
              onSelect={handleSelectPatient}
              disabled={!!editingId} />
          </div>

          {/* Delivery info */}
          <Select label="วิธีจัดส่ง" required value={form.delivery_method}
            onChange={e => f('delivery_method', e.target.value)}
            placeholder="เลือกวิธี"
            options={['ไปรษณีย์', 'Messenger', 'มารับด้วยตนเอง', 'จัดส่งถึงบ้าน'].map(m => ({ value: m, label: m }))} />
          {editingId && (
            <Select label="สถานะ" value={form.status} onChange={e => f('status', e.target.value)}
              options={Object.entries(STATUS_MAP).map(([v, { label }]) => ({ value: v, label }))} />
          )}

          <Input label="ชื่อผู้รับ" required value={form.receiver_name} onChange={e => f('receiver_name', e.target.value)} />
          <Input label="เบอร์โทรผู้รับ" required value={form.receiver_phone} onChange={e => f('receiver_phone', e.target.value)} />
          <div className="sm:col-span-2">
            <Textarea label="ที่อยู่จัดส่ง" required value={form.address}
              onChange={e => f('address', e.target.value)} rows={2} />
          </div>

          {/* ผู้จัดส่ง — ซ่อนเมื่อมารับด้วยตนเอง */}
          {form.delivery_method !== 'มารับด้วยตนเอง' && (<>
            <Input label="ชื่อผู้จัดส่ง" value={form.courier_name} onChange={e => f('courier_name', e.target.value)}
              placeholder="ชื่อพนักงานส่ง / บริษัทขนส่ง" />
            <Input label="เบอร์โทรผู้จัดส่ง" value={form.courier_phone} onChange={e => f('courier_phone', e.target.value)}
              placeholder="0812345678" />
            <Input label="เลขพัสดุ / Tracking" value={form.tracking_number} onChange={e => f('tracking_number', e.target.value)}
              placeholder="เลขติดตามพัสดุ" />
          </>)}

          {/* Medicine List */}
          <div className="sm:col-span-2">
            <p className="text-sm font-medium text-slate-700 mb-2">รายการยา</p>

            {/* Drug search */}
            <div ref={searchRef} className="relative mb-3">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหายาเพื่อเพิ่ม..."
                  value={drugSearch}
                  onChange={e => setDrugSearch(e.target.value)}
                  onFocus={() => drugResults.length > 0 && setShowDropdown(true)}
                  className="w-full pl-8 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
                {drugLoading && <span className="absolute right-3 top-1/2 -translate-y-1/2"><Spinner size={14} /></span>}
              </div>
              {showDropdown && drugResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                  {drugResults.map(drug => {
                    const isAllergy = patientAllergies.includes(drug.med_id);
                    const inList = form.medicine_list.some(m => m.med_sid === drug.med_sid);
                    return (
                      <button key={drug.med_sid} type="button"
                        onClick={() => addDrug(drug)}
                        disabled={inList}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 transition-colors ${inList ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <Pill size={14} className="text-slate-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {drug.med_showname || drug.med_name}
                            {isAllergy && <AlertTriangle size={12} className="inline ml-1 text-red-500" />}
                          </p>
                          <p className="text-xs text-slate-400">{drug.med_name} · คงเหลือ {drug.current_stock ?? 0} {drug.unit}</p>
                        </div>
                        <Plus size={14} className="text-primary-500 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Medicine list items */}
            {form.medicine_list.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg">ยังไม่มีรายการยา</p>
            ) : (
              <>
                <div className="space-y-2">
                  {form.medicine_list.map(item => (
                    <div key={item.med_sid} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg">
                      <Pill size={14} className="text-primary-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{item.med_showname || item.med_name}</p>
                        <p className="text-xs text-slate-400">คงเหลือ {item.stock} {item.unit}</p>
                      </div>
                      <input
                        type="number" min={1} max={item.stock}
                        value={item.quantity}
                        onChange={e => changeQty(item.med_sid, parseInt(e.target.value) || 1)}
                        className="w-16 text-center text-sm border border-slate-200 rounded-md py-1 focus:outline-none focus:ring-1 focus:ring-primary-300"
                      />
                      <span className="text-xs text-slate-400">{item.unit}</span>
                      {item.unit_price > 0 && (
                        <span className="text-xs text-slate-500 whitespace-nowrap">
                          = {(item.unit_price * item.quantity).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                        </span>
                      )}
                      <button type="button" onClick={() => removeDrug(item.med_sid)}
                        className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                {form.medicine_list.some(m => m.unit_price > 0) && (
                  <div className="flex justify-end mt-2 px-1">
                    <span className="text-xs text-slate-500 mr-2">ยอดรวม:</span>
                    <span className="text-sm font-bold text-primary-700">
                      {form.medicine_list.reduce((s, m) => s + m.unit_price * m.quantity, 0)
                        .toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Note */}
          <div className="sm:col-span-2">
            <Textarea label="หมายเหตุ" value={form.note}
              onChange={e => f('note', e.target.value)} rows={2} />
          </div>
        </FormGrid>
      </CrudModal>

      {/* Detail Drawer */}
      <DetailDrawer
        open={!!drawer} onClose={() => setDrawer(null)}
        title={drawer ? `การจัดส่ง: ${drawer.patient_name}` : ''}
        subtitle={drawer ? (STATUS_MAP[drawer.status as keyof typeof STATUS_MAP]?.label ?? drawer.status) : ''}
      >
        {drawer && (
          <>
            <DrawerSection title="ข้อมูลการจัดส่ง">
              <button
                onClick={() => drawer.patient_id && setPatientDrawerId(drawer.patient_id)}
                className="flex items-center gap-3 mb-3 w-full text-left group"
              >
                {drawer.patient_photo ? (
                  <img
                    src={`/images/patient_image/${drawer.patient_photo}`}
                    alt={drawer.patient_name || 'ผู้ป่วย'}
                    className="w-14 h-14 rounded-full object-cover border-2 border-slate-200 shadow-sm flex-shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 border-2 border-slate-200">
                    <span className="text-primary-600 font-bold text-xl">{(drawer.patient_name || '?')[0]}</span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate group-hover:text-primary-600 transition-colors underline decoration-dotted underline-offset-2">
                    {drawer.patient_name || 'ไม่ระบุ'}
                  </p>
                  <p className="text-xs text-slate-400 font-mono">HN: {drawer.hn_number || '—'}</p>
                </div>
              </button>
              <DrawerGrid items={[
                { label: 'เลขพัสดุ', value: drawer.tracking_number || '—' },
                { label: 'ผู้รับ', value: drawer.receiver_name || '—' },
                { label: 'ที่อยู่', value: drawer.address || '—', span: true },
                { label: 'วิธีจัดส่ง', value: drawer.delivery_method || '—' },
                { label: 'เบอร์โทรศัพท์ผู้รับ', value: drawer.receiver_phone || '—' },
                { label: 'ผู้จัดส่ง', value: drawer.courier_name || '—' },
                { label: 'เบอร์โทรศัพท์ผู้จัดส่ง', value: drawer.courier_phone || '—' },
                { label: 'วันที่จัดส่ง', value: fmtDate(drawer.delivery_date) },
                { label: 'เวลาจัดส่งจริง', value: drawer.delivered_at ? fmtDate(drawer.delivered_at, true) : '—' },
                { label: 'สถานะ', value: statusBadge(drawer.status) },
                { label: 'หมายเหตุ', value: drawer.note || '—', span: true },
              ]} />
            </DrawerSection>

            <DrawerSection title="ประวัติแพ้ยา">
              {drawerAllergyLoading ? (
                <div className="flex justify-center py-4"><Spinner size={16} /></div>
              ) : drawerAllergies.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">ไม่มีประวัติแพ้ยา</p>
              ) : (
                <div className="space-y-2">
                  {drawerAllergies.map((a: any) => (
                    <div key={a.allr_id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-red-50 border border-red-100">
                      <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {a.med_name || a.med_showname || `ยา #${a.med_id}`}
                        </p>
                        {a.symptoms && <p className="text-xs text-slate-500 mt-0.5">{a.symptoms}</p>}
                      </div>
                      <Badge variant={
                        a.severity === 'severe' ? 'danger' :
                          a.severity === 'moderate' ? 'warning' : 'gray'
                      }>
                        {a.severity === 'severe' ? 'รุนแรงมาก' : a.severity === 'moderate' ? 'ปานกลาง' : 'เล็กน้อย'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </DrawerSection>

            {Array.isArray(drawer.medicine_list) && drawer.medicine_list.length > 0 && (
              <DrawerSection title={`รายการยา (${drawer.medicine_list.length} รายการ)${Number(drawer.total_cost) > 0 ? ` · ${Number(drawer.total_cost).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท` : ''}`}>
                <div className="space-y-2">
                  {drawer.medicine_list.map((item: any, i: number) => (
                    <div key={i} className="rounded-xl border px-4 py-3 bg-slate-50 border-slate-100">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800">{item.med_name || item.med_showname}</p>
                          {item.med_generic_name && (
                            <p className="text-xs text-slate-500 mt-0.5">{item.med_generic_name}</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-slate-800">
                            {item.quantity} {item.unit || 'หน่วย'}
                          </p>
                          {Number(item.unit_price) > 0 && (
                            <p className="text-xs text-primary-600 font-medium">
                              {Number(item.unit_price).toFixed(2)} × {item.quantity} = {(Number(item.unit_price) * item.quantity).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </DrawerSection>
            )}

            <DrawerSection title="">
              <Button variant="secondary" onClick={() => { setDrawer(null); openEdit(drawer); }}>แก้ไข</Button>
            </DrawerSection>
          </>
        )}
      </DetailDrawer>

      <PatientDrawer
        patientId={patientDrawerId}
        open={!!patientDrawerId}
        onClose={() => setPatientDrawerId(null)}
      />
    </MainLayout>
  );
}
