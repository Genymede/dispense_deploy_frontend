'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef, ExportButtons } from '@/components/DataTable';
import { CrudModal, FormSection, RowActions } from '@/components/CrudModal';
import { Input, Select, Textarea, Badge, Button, Spinner } from '@/components/ui';
import SearchSelect from '@/components/SearchSelect';
import DetailDrawer, { DrawerSection, DrawerGrid } from '@/components/DetailDrawer';
import PatientDrawer from '@/components/PatientDrawer';
import { registryApi, crudApi, drugApi, api, type Drug } from '@/lib/api';
import { validateDrugLots } from '@/lib/drugUtils';
import { Truck, Pill, X, AlertTriangle, Search, Plus, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtDate } from '@/lib/dateUtils';

const FREQ = ['วันละ 1 ครั้ง', 'วันละ 2 ครั้ง', 'วันละ 3 ครั้ง', 'วันละ 4 ครั้ง', 'ใช้เมื่อมีอาการ', 'ให้ยาทันที', 'ทุกๆ 4 ชั่วโมง', 'ทุกๆ 6 ชั่วโมง', 'ทุกๆ 8 ชั่วโมง', 'ทุกๆ 12 ชั่วโมง'];
const ROUTE = ['รับประทาน', 'ฉีดเข้ากล้ามเนื้อ', 'ฉีดเข้าเส้นเลือด', 'พ่น', 'ทาภายนอก', 'หยอดตา', 'หยอดหู', 'อม', 'เหน็บ'];

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
  dose_qty: number;
  dose_unit: string;
  frequency: string;
  route: string;
  meal_relation: string;
  meal_sessions: string;
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

  const [drugUnits, setDrugUnits] = useState<string[]>(['เม็ด', 'แคปซูล', 'ซอง', 'มล.', 'กรัม', 'ไวแอล', 'แอมพูล', 'หลอด']);

  // drug search state
  const [drugSearch, setDrugSearch] = useState('');
  const [drugResults, setDrugResults] = useState<Drug[]>([]);
  const [drugLoading, setDrugLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [patientAllergies, setPatientAllergies] = useState<number[]>([]); // med_id list

  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    api.get('/settings').then(r => {
      if (r.data.drug_units) try { setDrugUnits(JSON.parse(r.data.drug_units)); } catch { }
    }).catch(() => {});
  }, []);

  const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  const updateMed = (med_sid: number, k: keyof MedItem, v: any) =>
    setForm(p => ({ ...p, medicine_list: p.medicine_list.map(m => m.med_sid === med_sid ? { ...m, [k]: v } : m) }));

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
    const { ok, available } = await validateDrugLots(drug.med_sid, drug.med_showname || drug.med_name);
    if (!ok) return;

    const item: MedItem = {
      med_sid: drug.med_sid,
      med_id: drug.med_id,
      med_name: drug.med_name || '',
      med_showname: drug.med_showname || drug.med_name || '',
      quantity: 1,
      unit: drug.unit || '',
      stock: available,
      unit_price: drug.unit_price ?? 0,
      dose_qty: 1,
      dose_unit: drug.unit || 'เม็ด',
      frequency: 'วันละ 1 ครั้ง',
      route: 'รับประทาน',
      meal_relation: '',
      meal_sessions: '',
    };
    setForm(p => ({ ...p, medicine_list: [...p.medicine_list, item] }));
    if (errors.medicine_list) setErrors(p => ({ ...p, medicine_list: '' }));
  };

  const removeDrug = (med_sid: number) =>
    setForm(p => ({ ...p, medicine_list: p.medicine_list.filter(m => m.med_sid !== med_sid) }));

  const changeQty = (med_sid: number, qty: number) => {
    const item = form.medicine_list.find(m => m.med_sid === med_sid);
    if (item && qty > item.stock) { toast.error(`สต็อกมีเพียง ${item.stock} หน่วย`); return; }
    setForm(p => ({ ...p, medicine_list: p.medicine_list.map(m => m.med_sid === med_sid ? { ...m, quantity: Math.max(1, qty) } : m) }));
  };

  const [errors, setErrors] = useState<Record<string,string>>({});

  const openAdd = () => {
    setForm(emptyForm); setEditingId(null); setResetKey(k => k + 1);
    setDrugSearch(''); setDrugResults([]); setPatientAllergies([]);
    setErrors({}); setShowModal(true);
  };

  const openEdit = (row: any) => {
    if (row.status === 'Delivered' || row.status === 'Cancelled') {
      toast.error('ไม่สามารถแก้ไขได้ สถานะสิ้นสุดแล้ว');
      return;
    }
    const medList: MedItem[] = (Array.isArray(row.medicine_list) ? row.medicine_list : []).map((m: any) => ({
      ...m,
      dose_qty: m.dose_qty ?? 1,
      dose_unit: m.dose_unit ?? m.unit ?? 'เม็ด',
      frequency: m.frequency ?? 'วันละ 1 ครั้ง',
      route: m.route ?? 'รับประทาน',
      meal_relation: m.meal_relation ?? '',
      meal_sessions: m.meal_sessions ?? '',
    }));
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
    setErrors({}); setShowModal(true);
  };

  const handleSave = async () => {
    const errs: Record<string,string> = {};
    if (!form.patient_id) errs.patient_id = 'กรุณาเลือกผู้ป่วย';
    if (!form.delivery_method) errs.delivery_method = 'กรุณาเลือกวิธีจัดส่ง';
    if (!form.receiver_name.trim()) errs.receiver_name = 'กรุณากรอกชื่อผู้รับ';
    if (!form.receiver_phone) errs.receiver_phone = 'กรุณากรอกเบอร์โทร';
    else if (!/^0\d{8,9}$/.test(form.receiver_phone.replace(/[-\s]/g, ''))) errs.receiver_phone = 'เบอร์โทรไม่ถูกต้อง (ตัวอย่าง: 0812345678)';
    if (!form.address.trim()) errs.address = 'กรุณากรอกที่อยู่';
    if (!form.medicine_list || form.medicine_list.length === 0) errs.medicine_list = 'กรุณาเพิ่มรายการยาอย่างน้อย 1 รายการ';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      // ── ตรวจสอบล็อตยา (ข้ามล็อตหมดอายุตามเงื่อนไข FIFO/FEFO) ──
      for (const it of form.medicine_list) {
        const { ok } = await validateDrugLots(it.med_sid, it.med_showname || it.med_name, it.quantity);
        if (!ok) {
          setSaving(false);
          return;
        }
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
          med_name: m.med_showname || m.med_name, unit: m.unit, unit_price: m.unit_price ?? 0,
          dose_qty: m.dose_qty, dose_unit: m.dose_unit,
          frequency: m.frequency, route: m.route,
          meal_relation: m.meal_relation || null,
          meal_sessions: m.meal_sessions || null,
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
        searchPlaceholder="ชื่อผู้ป่วย, HN, เลขบัตรประชาชน..."
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
        title="การจัดส่งยา" editingId={editingId} onSave={handleSave} saving={saving}>
        <div className="flex flex-col gap-5">

          <FormSection title="ผู้ป่วย" cols={1}>
            <div>
              <SearchSelect type="patient" label="ผู้ป่วย" required
                initialDisplay={form.patient_label} resetKey={resetKey}
                onSelect={p => { handleSelectPatient(p); if (errors.patient_id) setErrors(prev => ({ ...prev, patient_id: '' })); }}
                disabled={!!editingId} />
              {errors.patient_id && <p className="mt-1 text-xs text-red-500">{errors.patient_id}</p>}
            </div>
          </FormSection>

          <FormSection title="การจัดส่ง" cols={2}>
            <Select label="วิธีจัดส่ง" required value={form.delivery_method}
              onChange={e => { f('delivery_method', e.target.value); if (errors.delivery_method) setErrors(p => ({ ...p, delivery_method: '' })); }}
              placeholder="เลือกวิธี"
              options={['ไปรษณีย์', 'Messenger', 'มารับด้วยตนเอง', 'จัดส่งถึงบ้าน'].map(m => ({ value: m, label: m }))}
              error={errors.delivery_method} />
            {editingId
              ? <Select label="สถานะ" value={form.status} onChange={e => f('status', e.target.value)}
                  options={Object.entries(STATUS_MAP).map(([v, { label }]) => ({ value: v, label }))} />
              : <div />}
            <Input label="ชื่อผู้รับ" required value={form.receiver_name}
              onChange={e => { f('receiver_name', e.target.value); if (errors.receiver_name) setErrors(p => ({ ...p, receiver_name: '' })); }}
              error={errors.receiver_name} />
            <Input label="เบอร์โทรผู้รับ" required value={form.receiver_phone}
              onChange={e => { f('receiver_phone', e.target.value); if (errors.receiver_phone) setErrors(p => ({ ...p, receiver_phone: '' })); }}
              error={errors.receiver_phone} />
            <div className="sm:col-span-2">
              <Textarea label="ที่อยู่จัดส่ง" required value={form.address}
                onChange={e => { f('address', e.target.value); if (errors.address) setErrors(p => ({ ...p, address: '' })); }}
                rows={2} error={errors.address} />
            </div>
          </FormSection>

          {form.delivery_method && form.delivery_method !== 'มารับด้วยตนเอง' && (
            <FormSection title="ผู้จัดส่ง" cols={3}>
              <Input label="ชื่อผู้จัดส่ง" value={form.courier_name} onChange={e => f('courier_name', e.target.value)}
                placeholder="ชื่อพนักงาน / บริษัทขนส่ง" />
              <Input label="เบอร์โทรผู้จัดส่ง" value={form.courier_phone} onChange={e => f('courier_phone', e.target.value)}
                placeholder="0812345678" />
              <Input label="เลขพัสดุ / Tracking" value={form.tracking_number} onChange={e => f('tracking_number', e.target.value)}
                placeholder="เลขติดตามพัสดุ" />
            </FormSection>
          )}

          <FormSection title="รายการยา" cols={1}>
            <div>
              {errors.medicine_list && <p className="mb-2 text-xs text-red-500">{errors.medicine_list}</p>}
              <div ref={searchRef} className="relative mb-3">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="ค้นหายาเพื่อเพิ่ม..."
                    value={drugSearch} onChange={e => setDrugSearch(e.target.value)}
                    onFocus={() => drugResults.length > 0 && setShowDropdown(true)}
                    className="w-full pl-8 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  {drugLoading && <span className="absolute right-3 top-1/2 -translate-y-1/2"><Spinner size={14} /></span>}
                </div>
                {showDropdown && drugResults.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                    {drugResults.map(drug => {
                      const isAllergy = patientAllergies.includes(drug.med_id);
                      const inList = form.medicine_list.some(m => m.med_sid === drug.med_sid);
                      return (
                        <button key={drug.med_sid} type="button" onClick={() => addDrug(drug)} disabled={inList}
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
              {form.medicine_list.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg">ยังไม่มีรายการยา</p>
              ) : (
                <>
                  <div className="space-y-2">
                    {form.medicine_list.map(item => (
                      <div key={item.med_sid} className="bg-slate-50 rounded-xl p-3 space-y-2.5">
                        {/* Row 1: name + qty + price + delete */}
                        <div className="flex items-center gap-3">
                          <Pill size={14} className="text-primary-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{item.med_showname || item.med_name}</p>
                            <p className="text-xs text-slate-400">คงเหลือ {item.stock} {item.unit}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <input type="number" min={1} max={item.stock} value={item.quantity}
                              onChange={e => changeQty(item.med_sid, parseInt(e.target.value) || 1)}
                              className="w-16 text-center text-sm border border-slate-200 rounded-md py-1 focus:outline-none focus:ring-1 focus:ring-primary-300" />
                            <span className="text-xs text-slate-400">{item.unit}</span>
                            {item.unit_price > 0 && (
                              <span className="text-xs text-slate-500 whitespace-nowrap">
                                = {(item.unit_price * item.quantity).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                              </span>
                            )}
                          </div>
                          <button type="button" onClick={() => removeDrug(item.med_sid)}
                            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors shrink-0">
                            <X size={14} />
                          </button>
                        </div>
                        {/* Row 2: usage inputs */}
                        <div className="flex flex-wrap items-center gap-1.5 pl-[22px]">
                          <select value={item.route} onChange={e => updateMed(item.med_sid, 'route', e.target.value)}
                            className="h-7 border border-slate-200 rounded-lg text-xs px-1.5 outline-none bg-white focus:border-primary-400">
                            {ROUTE.map(o => <option key={o}>{o}</option>)}
                          </select>
                          <span className="text-xs text-slate-400">ครั้งละ</span>
                          <input type="number" min={0.25} step={0.25} value={item.dose_qty}
                            onChange={e => updateMed(item.med_sid, 'dose_qty', parseFloat(e.target.value) || 1)}
                            className="w-14 h-7 border border-slate-200 rounded-lg text-xs px-2 outline-none focus:border-primary-400 text-center" />
                          <select value={item.dose_unit} onChange={e => updateMed(item.med_sid, 'dose_unit', e.target.value)}
                            className="h-7 border border-slate-200 rounded-lg text-xs px-1.5 outline-none bg-white focus:border-primary-400">
                            {drugUnits.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                          <select value={item.frequency} onChange={e => updateMed(item.med_sid, 'frequency', e.target.value)}
                            className="h-7 border border-slate-200 rounded-lg text-xs px-1.5 outline-none bg-white focus:border-primary-400">
                            {FREQ.map(o => <option key={o}>{o}</option>)}
                          </select>
                          <select value={item.meal_relation} onChange={e => updateMed(item.med_sid, 'meal_relation', e.target.value)}
                            className="h-7 border border-slate-200 rounded-lg text-xs px-1.5 outline-none bg-white focus:border-primary-400">
                            <option value="">ไม่ระบุเวลา</option>
                            <option>ก่อนอาหาร</option>
                            <option>หลังอาหาร</option>
                            <option>พร้อมอาหาร</option>
                          </select>
                          {['เช้า', 'กลางวัน', 'เย็น', 'ก่อนนอน'].map(s => {
                            const sessions = (item.meal_sessions || '').split(',').filter(Boolean);
                            const active = sessions.includes(s);
                            return (
                              <button key={s} type="button"
                                onClick={() => {
                                  const next = active ? sessions.filter(x => x !== s) : [...sessions, s];
                                  updateMed(item.med_sid, 'meal_sessions', next.join(','));
                                }}
                                className={`h-7 px-2 text-xs rounded-lg border font-medium transition-colors ${active ? 'bg-primary-100 text-primary-700 border-primary-400' : 'bg-white text-slate-400 border-slate-200 hover:border-primary-400 hover:text-primary-600'}`}>
                                {s}
                              </button>
                            );
                          })}
                        </div>
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
          </FormSection>

          <FormSection title="หมายเหตุ" cols={1}>
            <Textarea value={form.note} onChange={e => f('note', e.target.value)} rows={2} />
          </FormSection>

        </div>
      </CrudModal>

      {/* Detail Drawer */}
      <DetailDrawer
        open={!!drawer} onClose={() => setDrawer(null)}
        title="รายละเอียดการจัดส่ง"
        subtitle={drawer ? drawer.patient_name : ''}
        width="lg"
        footer={drawer && (
          <Button variant="secondary" size="sm" icon={<Edit2 size={13} />}
            onClick={() => { setDrawer(null); openEdit(drawer); }}>
            แก้ไข
          </Button>
        )}
      >
        {drawer && (
          <>
            {/* Patient banner */}
            <button onClick={() => drawer.patient_id && setPatientDrawerId(drawer.patient_id)}
              className="w-full flex items-center gap-4 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-2xl text-left group transition-colors mb-1">
              <img
                src={`/images/patient_image/${drawer.patient_photo || 'user.png'}`}
                alt={drawer.patient_name}
                onError={e => { (e.target as HTMLImageElement).src = '/images/patient_image/user.png'; }}
                className="w-12 h-12 rounded-full object-cover border-2 border-white shadow shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 group-hover:text-primary-600 transition-colors">
                  {drawer.patient_name || 'ไม่ระบุ'}
                </p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">HN: {drawer.hn_number || '—'}</p>
              </div>
              {statusBadge(drawer.status)}
            </button>

            {/* Delivery info grid */}
            <DrawerSection title="ข้อมูลการจัดส่ง">
              <DrawerGrid items={[
                { label: 'วันที่จัดส่ง', value: fmtDate(drawer.delivery_date) },
                { label: 'วันที่รับยา',  value: drawer.delivered_at ? fmtDate(drawer.delivered_at, true) : '—' },
                { label: 'วิธีจัดส่ง',   value: drawer.delivery_method || '—' },
                { label: 'เลขพัสดุ',     value: drawer.tracking_number || '—' },
              ]} />
            </DrawerSection>

            <DrawerSection title="ข้อมูลผู้รับ">
              <DrawerGrid items={[
                { label: 'ผู้รับ',         value: drawer.receiver_name || '—' },
                { label: 'เบอร์โทรผู้รับ', value: drawer.receiver_phone || '—' },
                { label: 'ที่อยู่',        value: drawer.address || '—', span: true },
              ]} />
            </DrawerSection>

            <DrawerSection title="ผู้จัดส่ง">
              <DrawerGrid items={[
                { label: 'ชื่อผู้จัดส่ง',    value: drawer.courier_name || '—' },
                { label: 'เบอร์โทรผู้จัดส่ง', value: drawer.courier_phone || '—' },
              ]} />
            </DrawerSection>

            {/* Allergies — only when present */}
            {(drawerAllergyLoading || drawerAllergies.length > 0) && (
              <DrawerSection title="ประวัติแพ้ยา">
                {drawerAllergyLoading ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400"><Spinner size={12} /> กำลังตรวจสอบ...</div>
                ) : (
                  <div className="space-y-2">
                    {drawerAllergies.map((a: any) => (
                      <div key={a.allr_id} className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-red-50 border border-red-100">
                        <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800">{a.med_name || `ยา #${a.med_id}`}</p>
                          {a.symptoms && <p className="text-xs text-slate-500 mt-0.5">{a.symptoms}</p>}
                        </div>
                        <Badge variant={a.severity === 'severe' ? 'danger' : a.severity === 'moderate' ? 'warning' : 'gray'}>
                          {a.severity === 'severe' ? 'รุนแรงมาก' : a.severity === 'moderate' ? 'ปานกลาง' : 'เล็กน้อย'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </DrawerSection>
            )}

            {/* Medicine list */}
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
                      {drawer.medicine_list.map((item: any, i: number) => {
                        const mealStr = item.meal_sessions ? item.meal_sessions.split(',').filter(Boolean).join(' ') : '';
                        const usage = [
                          item.route,
                          item.dose_qty ? `ครั้งละ ${item.dose_qty} ${item.dose_unit || ''}` : '',
                          item.frequency,
                          item.meal_relation,
                          mealStr,
                        ].filter(Boolean).join('  ');
                        return (
                          <tr key={i}>
                            <td className="px-3 py-3 text-xs text-slate-300 text-center align-top">{i + 1}</td>
                            <td className="px-3 py-3">
                              <p className="font-semibold text-slate-800 leading-snug">{item.med_name || item.med_showname}</p>
                              {usage && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{usage}</p>}
                            </td>
                            <td className="px-3 py-3 text-center align-top whitespace-nowrap">
                              <span className="font-semibold text-slate-700">{item.quantity}</span>
                              <span className="text-xs text-slate-400 ml-1">{item.unit || ''}</span>
                            </td>
                            <td className="px-3 py-3 text-right align-top whitespace-nowrap">
                              {Number(item.unit_price) > 0 ? (
                                <div>
                                  <p className="font-semibold text-slate-700">{(Number(item.unit_price) * item.quantity).toFixed(2)}</p>
                                  <p className="text-xs text-slate-400">{Number(item.unit_price).toFixed(2)} × {item.quantity}</p>
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
