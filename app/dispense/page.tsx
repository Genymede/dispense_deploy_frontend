'use client';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import MainLayout from '@/components/MainLayout';
import { Card, Input, Select, Badge, Button, Modal, EmptyState, Spinner, Textarea, ConfirmDialog } from '@/components/ui';
import SearchSelect from '@/components/SearchSelect';
import SafetyPanel from '@/components/SafetyPanel';
import PatientDrawer from '@/components/PatientDrawer';
import { useConfirm } from '@/hooks/useConfirm';
import { dispenseApi, safetyApi, api, printerApi, queueApi, registryApi, patientApi, drugApi, type Prescription, type SafetyCheckResult, type SafetyAlert } from '@/lib/api';
import { validateDrugLots, fmtFreq } from '@/lib/drugUtils';
import { useAuth } from '@/lib/auth';
import {
  Plus, Package, Trash2, RefreshCw,
  Shield, ShieldX, ShieldAlert, ShieldCheck, Wand2,
  AlertTriangle, CheckCircle2, Loader2, Printer,
  PhoneCall, ClipboardCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtDate, fmtTime } from '@/lib/dateUtils';

// ─── Constants ────────────────────────────────────────────────────────────────
const TREATMENT_RIGHT_LABEL: Record<string, string> = {
  UC: 'บัตรทอง (UC)', SSO: 'ประกันสังคม', GOVT: 'สวัสดิการข้าราชการ',
  LGO: 'องค์กรปกครองส่วนท้องถิ่น', SELF: 'ชำระเองเต็ม', OTHER: 'อื่นๆ',
};
function treatmentRightLabel(right?: string | null, note?: string | null): string | null {
  if (!right) return null;
  const label = TREATMENT_RIGHT_LABEL[right] ?? right;
  return right === 'OTHER' && note ? `${label}: ${note}` : label;
}

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'gray' | 'info'> = {
  dispensed: 'success', pending: 'warning', returned: 'gray', cancelled: 'danger',
};
const STATUS_TH: Record<string, string> = {
  dispensed: 'จ่ายแล้ว', pending: 'รอจ่าย', returned: 'คืนยา', cancelled: 'ยกเลิก',
};
const QUEUE_STATUS: Record<string, { label: string; badge: string }> = {
  waiting: { label: 'รอเรียก', badge: 'bg-amber-100 text-amber-700' },
  called: { label: 'กำลังเรียก', badge: 'bg-blue-100 text-blue-700' },
  completed: { label: 'เสร็จแล้ว', badge: 'bg-green-100 text-green-700' },
  skipped: { label: 'ข้าม', badge: 'bg-slate-100 text-slate-500' },
};
const DISPENSE_TABS = [
  { key: 'prescriptions', label: 'ใบสั่งยา', icon: <Package size={14} /> },
  { key: 'dispensed', label: 'รายชื่อจ่ายยาแล้ว', icon: <ClipboardCheck size={14} /> },
] as const;

const FREQ = ['วันละ 1 ครั้ง', 'วันละ 2 ครั้ง', 'วันละ 3 ครั้ง', 'วันละ 4 ครั้ง', 'ใช้เมื่อมีอาการ', 'ให้ยาทันที', 'ทุกๆ 4 ชั่วโมง', 'ทุกๆ 6 ชั่วโมง', 'ทุกๆ 8 ชั่วโมง', 'ทุกๆ 12 ชั่วโมง'];
const ROUTE = ['รับประทาน', 'ฉีดเข้ากล้ามเนื้อ', 'ฉีดเข้าเส้นเลือด', 'พ่น', 'ทาภายนอก', 'หยอดตา', 'หยอดหู', 'อม', 'เหน็บ'];

interface DrugItem {
  med_sid: number; med_id?: number; med_showname: string; med_name: string;
  quantity: number; dose_qty?: number; dose_unit?: string;
  frequency: string; route: string; unit: string;
  unit_price: number; meal_relation?: string; meal_sessions?: string;
}

// ─── Mini safety badge (ใช้ใน form ขณะพิมพ์) ─────────────────────────────────
function InlineSafetyBadge({ alerts }: { alerts: any[] }) {
  if (!alerts.length) return (
    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
      <CheckCircle2 size={12} /> ปลอดภัย
    </span>
  );
  const hasCrit = alerts.some(a => a.level === 'critical');
  const Icon = hasCrit ? ShieldX : ShieldAlert;
  const cls = hasCrit ? 'text-red-600' : 'text-amber-600';
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${cls}`}>
      <Icon size={12} /> {alerts.length} รายการ {hasCrit ? '⛔' : '⚠'}
    </span>
  );
}

// ─── Drug row in edit/create form ─────────────────────────────────────────────
function DrugRow({ item, idx, onUpdate, onRemove, alerts, drugUnits }: {
  item: DrugItem; idx: number;
  onUpdate: (k: keyof DrugItem, v: any) => void;
  onRemove: () => void;
  alerts: any[];
  drugUnits: string[];
}) {
  const hasCrit = alerts.some(a => a.level === 'critical');
  const hasWarn = alerts.some(a => a.level === 'warning');
  const rowCls = hasCrit ? 'bg-red-50 border-red-100' : hasWarn ? 'bg-amber-50 border-amber-100' : '';

  return (
    <tr className={`border-b border-slate-50 ${rowCls}`}>
      <td className="px-3 py-2.5 text-center text-slate-300 font-medium w-6">{idx + 1}</td>
      {/* ชื่อยา */}
      <td className="px-3 py-2.5">
        <p className="text-base font-semibold text-slate-800">{item.med_showname || item.med_name}</p>
        <p className="text-xs text-slate-400">{item.med_name}</p>
        {alerts.length > 0 && (
          <div className="mt-0.5 space-y-0.5">
            {alerts.slice(0, 2).map((a, i) => (
              <p key={i} className={`text-[10px] font-medium ${a.level === 'critical' ? 'text-red-600' : 'text-amber-600'}`}>
                {a.title}
              </p>
            ))}
          </div>
        )}
      </td>
      {/* จำนวน */}
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="flex items-center gap-1">
          <input type="number" min="1" value={item.quantity}
            onChange={e => onUpdate('quantity', Number(e.target.value))}
            className="w-16 h-7 border border-slate-200 rounded-lg text-xs px-2 outline-none focus:border-primary-500 text-center" />
          <span className="text-xs text-slate-400">{item.unit}</span>
        </div>
      </td>
      {/* วิธีใช้ */}
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <select value={item.route} onChange={e => onUpdate('route', e.target.value)}
            className="h-7 border border-slate-200 rounded-lg text-xs px-1.5 outline-none bg-white focus:border-primary-500">
            {ROUTE.map(o => <option key={o}>{o}</option>)}
          </select>
          <input type="number" min="0.25" step="0.25" value={item.dose_qty || 1}
            onChange={e => onUpdate('dose_qty', parseFloat(e.target.value) || 1)}
            className="w-14 h-7 border border-slate-200 rounded-lg text-xs px-2 outline-none focus:border-primary-500 text-center" />
          <select value={item.dose_unit || ''} onChange={e => onUpdate('dose_unit', e.target.value)}
            className="h-7 border border-slate-200 rounded-lg text-xs px-1.5 outline-none bg-white focus:border-primary-500">
            {drugUnits.length === 0
              ? <option value="เม็ด">เม็ด</option>
              : drugUnits.map(u => <option key={u} value={u}>{u}</option>)
            }
          </select>
          <span className="text-xs text-slate-400">/ครั้ง</span>
          <select value={item.frequency} onChange={e => onUpdate('frequency', e.target.value)}
            className="h-7 border border-slate-200 rounded-lg text-xs px-1.5 outline-none bg-white focus:border-primary-500">
            {FREQ.map(o => <option key={o}>{o}</option>)}
          </select>
          <select value={item.meal_relation || ''} onChange={e => onUpdate('meal_relation', e.target.value)}
            className="h-7 border border-slate-200 rounded-lg text-xs px-1.5 outline-none bg-white focus:border-primary-500">
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
                  const next = active ? sessions.filter((x: string) => x !== s) : [...sessions, s];
                  onUpdate('meal_sessions', next.join(','));
                }}
                className={`h-7 px-2 text-xs rounded-lg border font-medium transition-colors ${active ? 'bg-primary-100 text-primary-700 border-primary-400' : 'bg-white text-slate-400 border-slate-200 hover:border-primary-400 hover:text-primary-600'}`}>
                {s}
              </button>
            );
          })}
        </div>
      </td>
      {/* ราคา */}
      <td className="px-3 py-2 text-right text-xs text-slate-500 whitespace-nowrap">
        {item.unit_price > 0
          ? <><span className="text-slate-400">{Number(item.unit_price).toFixed(2)} × {item.quantity} = </span><span className="font-semibold text-slate-700">{(Number(item.unit_price) * item.quantity).toFixed(2)}</span></>
          : <span className="text-slate-300">—</span>
        }
      </td>
      <td className="px-3 py-2 text-right">
        <button onClick={onRemove} className="text-slate-300 hover:text-red-500 transition-colors">
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DispensePage() {
  const { user } = useAuth();
  const { confirm: confirmDialog, dialogProps: confirmDialogProps } = useConfirm();

  // list
  const [rxList, setRxList] = useState<Prescription[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [fStatus, setFStatus] = useState('pending');
  const [fWard, setFWard] = useState('');
  const [loading, setLoading] = useState(false);
  const perPage = 30;
  const listTimer = useRef<ReturnType<typeof setTimeout>>();

  // create / edit form state
  const [showCreate, setShowCreate] = useState(false);
  const [editingRxId, setEditingRxId] = useState<number | null>(null);
  const [patientId, setPatientId] = useState(0);
  const [patientLabel, setPatientLabel] = useState('');
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [doctorLabel, setDoctorLabel] = useState('');
  const [ward, setWard] = useState('');
  const [note, setNote] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [patientTreatmentRight, setPatientTreatmentRight] = useState<string | null>(null);
  const [patientTreatmentRightNote, setPatientTreatmentRightNote] = useState<string | null>(null);
  const [items, setItems] = useState<DrugItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // create form — patient demographics panel
  const [createPatientDetail, setCreatePatientDetail] = useState<any | null>(null);
  const [createAllergies, setCreateAllergies] = useState<any[]>([]);
  const [createAllergyLoading, setCreateAllergyLoading] = useState(false);
  const [createVitals, setCreateVitals] = useState({ temp: '', bp: '' });
  const [addToQueue, setAddToQueue] = useState(false);

  // live safety (create/edit form)
  const [liveAlerts, setLiveAlerts] = useState<Record<number, any[]>>({}); // med_sid → alerts
  const [loadingSafety, setLoadingSafety] = useState(false);
  const safetyTimer = useRef<ReturnType<typeof setTimeout>>();

  const [patientDrawerId, setPatientDrawerId] = useState<number | null>(null);

  // dispense modal (confirm + full safety)
  const [dispenseRx, setDispenseRx] = useState<any | null>(null);
  const [dispenseAllergies, setDispenseAllergies] = useState<any[]>([]);
  const [dispensePatientDetail, setDispensePatientDetail] = useState<any | null>(null);
  const [safetyResult, setSafetyResult] = useState<SafetyCheckResult | null>(null);
  const [dispensing, setDispensing] = useState(false);
  const [dispenseItems, setDispenseItems] = useState<any[]>([]);
  const [printSelected, setPrintSelected] = useState<Set<number>>(new Set());
  const [printingLabel, setPrintingLabel] = useState(false);

  // overdue — item_ids ที่ผู้ใช้เลือกให้บันทึกเป็นยาค้างจ่าย
  const [pendingOverdueIds, setPendingOverdueIds] = useState<Set<number>>(new Set());

  // dispense modal inline edit (items)
  const [dispenseItemsChanged, setDispenseItemsChanged] = useState(false);
  const [dispenseAddResetKey, setDispenseAddResetKey] = useState(0);

  // dispense modal inline edit (meta)
  const [dispenseWard, setDispenseWard] = useState('');
  const [dispenseDoctorId, setDispenseDoctorId] = useState<string | null>(null);
  const [dispenseDoctorLabel, setDispenseDoctorLabel] = useState('');
  const [dispenseNote, setDispenseNote] = useState('');
  const [dispenseDiagnosis, setDispenseDiagnosis] = useState('');
  const [dispenseMetaChanged, setDispenseMetaChanged] = useState(false);
  const [dispenseMetaResetKey, setDispenseMetaResetKey] = useState(0);

  const [updatingPregnancy, setUpdatingPregnancy] = useState(false);

  // mock
  const [mockCount, setMockCount] = useState(1);
  const [mocking, setMocking] = useState(false);

  // drug units from settings
  const [drugUnits, setDrugUnits] = useState<string[]>([]);
  useEffect(() => {
    api.get('/settings').then(r => {
      if (r.data.drug_units) try { setDrugUnits(JSON.parse(r.data.drug_units)); } catch { }
    }).catch(() => { });
  }, []);

  // ── Load list ──────────────────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dispenseApi.getAll({ search, status: fStatus || undefined, ward: fWard || undefined, page, limit: perPage });
      setRxList(res.data.data); setTotal(res.data.total);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [search, fStatus, fWard, page]);

  useEffect(() => {
    clearTimeout(listTimer.current);
    listTimer.current = setTimeout(loadList, 300);
  }, [loadList]);

  // ── Live safety check (runs when patient+items change) ─────────────────────
  const runLiveSafety = useCallback(async (pid: number, drugItems: Array<{ med_sid: number; med_id?: number }>) => {
    if (!pid || !drugItems.length) { setLiveAlerts({}); setLoadingSafety(false); return; }
    clearTimeout(safetyTimer.current);
    setLoadingSafety(true);
    safetyTimer.current = setTimeout(async () => {
      setLoadingSafety(true);
      try {
        const medIds = drugItems.map(i => i.med_id ?? 0).filter(Boolean);
        const res = await api.post('/dispense/live-safety', {
          patient_id: pid,
          med_ids: medIds,
          med_sids: drugItems.map(i => i.med_sid),
        });
        setLiveAlerts(res.data.alerts_by_med_sid ?? {});
      } catch { setLiveAlerts({}); }
      finally { setLoadingSafety(false); }
    }, 600);
  }, []);

  // only re-run when drug identity (which drugs) changes, not when quantity/dose/วิธีใช้ changes
  const itemDrugKeys = useMemo(
    () => items.map(it => `${it.med_sid}:${it.med_id ?? ''}`).join(','),
    [items]
  );
  useEffect(() => {
    if (showCreate) runLiveSafety(patientId, items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, itemDrugKeys, showCreate]);

  // Fetch full patient detail + allergies when patient selected in create form
  useEffect(() => {
    if (!showCreate || !patientId) {
      setCreatePatientDetail(null); setCreateAllergies([]);
      return;
    }
    setCreateAllergyLoading(true);
    Promise.all([
      patientApi.getById(patientId).then(r => setCreatePatientDetail(r.data.patient ?? r.data)).catch(() => { }),
      registryApi.getAllergy({ patient_id: patientId, limit: 50 })
        .then(r => setCreateAllergies(r.data.data ?? [])).catch(() => { }),
    ]).finally(() => setCreateAllergyLoading(false));
  }, [patientId, showCreate]);

  // ── Items ──────────────────────────────────────────────────────────────────
  const addItem = async (drug: any) => {
    if (!drug) return;
    if (items.find(i => i.med_sid === drug.med_sid)) { toast('ยานี้มีในรายการแล้ว'); return; }

    // ตรวจสอบล็อตยาและวันหมดอายุ (FEFO)
    const { ok } = await validateDrugLots(drug.med_sid, drug.med_showname || drug.med_name);
    if (!ok) return;

    setItems(prev => [...prev, {
      med_sid: drug.med_sid, med_id: drug.med_id,
      med_showname: drug.med_showname || drug.med_name,
      med_name: drug.med_name, quantity: 1,
      dose_qty: 1, dose_unit: drugUnits[0] || 'เม็ด',
      frequency: 'วันละ 1 ครั้ง',
      route: 'รับประทาน', unit: drug.unit || 'เม็ด',
      unit_price: Number(drug.unit_price) || Number(drug.list_selling_price) || 0,
      meal_relation: '', meal_sessions: '',
    }]);
  };
  const updateItem = (idx: number, k: keyof DrugItem, v: any) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [k]: v } : it));
  const removeItem = (idx: number) =>
    setItems(prev => prev.filter((_, i) => i !== idx));

  // ── Reset form ─────────────────────────────────────────────────────────────
  const resetForm = () => {
    setPatientId(0); setPatientLabel('');
    setDoctorId(null); setDoctorLabel('');
    setWard(''); setNote(''); setDiagnosis(''); setItems([]);
    setEditingRxId(null); setLiveAlerts({}); setFormErrors({});
    setPatientTreatmentRight(null); setPatientTreatmentRightNote(null);
    setCreatePatientDetail(null); setCreateAllergies([]);
    setCreateVitals({ temp: '', bp: '' }); setAddToQueue(false);
    setResetKey(k => k + 1);
  };

  // ── Open edit → redirect to dispense modal (now has inline editing) ───────
  const openEdit = async (rx: any) => {
    openDispense(rx);
  };

  // ── Save (create or edit) ──────────────────────────────────────────────────
  const handleSave = async () => {
    const errs: Record<string, string> = {};
    if (!patientId) errs.patient_id = 'กรุณาเลือกผู้ป่วย';
    if (!items.length) errs.items = 'กรุณาเพิ่มยาอย่างน้อย 1 รายการ';
    if (!ward.trim()) errs.ward = 'กรุณาระบุแผนก';
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    // Block on allergy or interaction alerts (ทุกระดับความรุนแรง)
    const blockingAlerts = Object.values(liveAlerts).flat().filter(a => a.type === 'allergy' || a.type === 'interaction');
    if (blockingAlerts.length > 0) {
      toast.error(`ไม่สามารถบันทึกได้ — พบ${blockingAlerts.some(a => a.type === 'allergy') ? 'การแพ้ยา' : ''}${blockingAlerts.some(a => a.type === 'allergy') && blockingAlerts.some(a => a.type === 'interaction') ? ' และ' : ''}${blockingAlerts.some(a => a.type === 'interaction') ? 'ยาที่ไม่เข้ากัน' : ''} ${blockingAlerts.length} รายการ`);
      return;
    }
    setSaving(true);
    try {
      if (editingRxId) {
        // แก้ items
        await api.put(`/dispense/${editingRxId}/items`, {
          items: items.map(it => ({
            med_sid: it.med_sid, quantity: it.quantity,
            dose: `${it.dose_qty ?? 1} ${it.dose_unit || ''}`.trim(),
            frequency: it.frequency, route: it.route,
            meal_relation: it.meal_relation || null, meal_sessions: it.meal_sessions || null,
          })),
        });
        // แก้ meta
        await api.put(`/dispense/${editingRxId}/meta`, { ward, note, diagnosis });
        toast.success('แก้ไขใบสั่งยาเรียบร้อย');
      } else {
        await dispenseApi.create({
          patient_id: patientId || undefined,
          doctor_id: doctorId || undefined,
          ward, note,
          items: items.map(it => ({
            med_sid: it.med_sid, quantity: it.quantity,
            dose: `${it.dose_qty ?? 1} ${it.dose_unit || ''}`.trim(),
            frequency: it.frequency, route: it.route,
            meal_relation: it.meal_relation || null, meal_sessions: it.meal_sessions || null,
          })),
        });
        if (addToQueue && patientId) {
          try { await queueApi.create({ patient_id: patientId, ward }); }
          catch { /* queue creation is non-blocking */ }
        }
        toast.success('สร้างใบสั่งยาเรียบร้อย');
      }
      setShowCreate(false); resetForm(); loadList();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  // ── Open dispense confirm ─────────────────────────────────────────────────
  const openDispense = async (rx: any) => {
    setDispenseRx(rx); setSafetyResult(null); setDispenseItems([]); setPrintSelected(new Set()); setPendingOverdueIds(new Set());
    setDispenseItemsChanged(false); setDispenseAddResetKey(k => k + 1); setLiveAlerts({});
    setDispenseWard(rx.ward || '');
    setDispenseDoctorId(rx.doctor_id || null);
    setDispenseDoctorLabel(rx.doctor_name || '');
    setDispenseNote(rx.note || '');
    setDispenseDiagnosis(rx.diagnosis || '');
    setDispenseMetaChanged(false); setDispenseMetaResetKey(k => k + 1);
    setDispenseAllergies([]); setDispensePatientDetail(null);
    // โหลด safety + items + allergies + patient detail พร้อมกัน
    Promise.all([
      safetyApi.check(rx.prescription_id)
        .then(r => setSafetyResult(r.data))
        .catch(() => { }),
      api.get(`/dispense/${rx.prescription_id}/full`)
        .then(r => {
          const items = (r.data.items ?? []).map((it: any) => {
            const parts = (it.dose || '').trim().split(/\s+/);
            const dose_qty = parseFloat(parts[0]) || 1;
            const dose_unit = parts.slice(1).join(' ') || drugUnits[0] || 'เม็ด';
            return { ...it, dose_qty, dose_unit, frequency: fmtFreq(it.frequency) };
          });
          setDispenseItems(items);
          setPrintSelected(new Set(items.map((_: any, i: number) => i)));
        })
        .catch(() => { }),
      rx.patient_id
        ? registryApi.getAllergy({ patient_id: rx.patient_id, limit: 50 })
          .then(r => setDispenseAllergies(r.data.data ?? []))
          .catch(() => { })
        : Promise.resolve(),
      rx.patient_id
        ? patientApi.getById(rx.patient_id)
          .then(r => setDispensePatientDetail(r.data.patient ?? r.data))
          .catch(() => { })
        : Promise.resolve(),
    ]);
  };
  // filter stock alerts สำหรับรายการที่ mark เป็น overdue แล้ว
  const filteredSafetyAlerts = useMemo((): SafetyAlert[] | undefined => {
    if (!safetyResult) return undefined;
    if (pendingOverdueIds.size === 0) return safetyResult.alerts;
    const overdueMedNames = new Set(
      dispenseItems
        .filter((it: any) => pendingOverdueIds.has(it.item_id))
        .flatMap((it: any) => [it.med_name, it.med_showname].filter(Boolean))
    );
    return safetyResult.alerts.filter(a => {
      // 1. กรองสต็อกถ้าจ่ายเป็นยาค้างจ่ายแล้ว
      const isStockOverdue = a.type === 'stock' && overdueMedNames.has(a.med_name ?? '');
      if (isStockOverdue) return false;

      // 2. กรองแจ้งเตือนหมดอายุ ถ้ายังมีสต็อกที่จ่ายได้จริง (Good lots)
      if (a.type === 'expired') {
        const item = safetyResult.items?.find(it => it.med_name === a.med_name);
        if (item && Number(item.stock_available) > 0) return false;
      }

      return true;
    });
  }, [safetyResult, pendingOverdueIds, dispenseItems]);

  // alert_level ที่ filter แล้ว (ใช้ check disabled)
  const filteredAlertLevel = useMemo(() => {
    if (!filteredSafetyAlerts) return null;
    if (filteredSafetyAlerts.some(a => a.level === 'critical')) return 'critical';
    if (filteredSafetyAlerts.some(a => a.level === 'warning')) return 'warning';
    return 'safe';
  }, [filteredSafetyAlerts]);

  const handleDispense = async () => {
    setDispensing(true);
    try {
      // ── ตรวจสอบล็อตยา (ข้ามล็อตหมดอายุตามเงื่อนไข FIFO/FEFO) ──
      for (const it of dispenseItems) {
        const { ok } = await validateDrugLots(it.med_sid, it.med_showname || it.med_name, it.quantity);
        if (!ok) {
          setDispensing(false);
          return;
        }
      }

      // บันทึก meta ที่แก้ไขก่อนจ่าย
      if (dispenseMetaChanged) {
        await api.put(`/dispense/${dispenseRx.prescription_id}/meta`, {
          ward: dispenseWard, note: dispenseNote, diagnosis: dispenseDiagnosis,
          doctor_id: dispenseDoctorId,
        });
      }
      // บันทึกรายการยาที่แก้ไขก่อนจ่าย
      if (dispenseItemsChanged) {
        await api.put(`/dispense/${dispenseRx.prescription_id}/items`, {
          items: dispenseItems.map((it: any) => ({
            med_sid: it.med_sid, quantity: it.quantity,
            dose: `${it.dose_qty ?? 1} ${it.dose_unit || ''}`.trim(),
            frequency: it.frequency || '', route: it.route || 'รับประทาน',
            meal_relation: it.meal_relation || null, meal_sessions: it.meal_sessions || null,
          })),
        });
      }
      const overdue_items = dispenseItems
        .filter((it: any) => pendingOverdueIds.has(it.item_id))
        .map((it: any) => ({
          item_id: it.item_id,
          overdue_qty: Math.max(0, Number(it.quantity) - Math.max(0, Number(it.stock_available))),
        }));
      const res = await dispenseApi.dispense(dispenseRx.prescription_id, undefined, overdue_items);
      const qNum = res.data?.queue_number;
      const pName = dispenseRx.patient_name || 'ผู้ป่วย';
      toast.success(
        qNum
          ? `🔔 เรียกคิว ${qNum} — ${pName} กรุณามารับยา`
          : overdue_items.length > 0
            ? `จ่ายยาเรียบร้อย (บันทึกยาค้างจ่าย ${overdue_items.length} รายการ)`
            : 'จ่ายยาเรียบร้อย',
        { duration: 6000 }
      );
      setDispenseRx(null); setSafetyResult(null); setPendingOverdueIds(new Set());
      setDispenseItemsChanged(false); setDispenseMetaChanged(false);
      void Promise.all([loadList(), loadQueue(), loadDispensed()]);
    } catch (e: any) { toast.error(e.message); }
    finally { setDispensing(false); }
  };

  // ── Print label (1 ใบ / 1 รายการยา) ──────────────────────────────────────
  const handlePrintLabel = async () => {
    const printerShare = localStorage.getItem('selected_printer_name');
    if (!printerShare) {
      toast.error('ยังไม่ได้เลือกเครื่องพิมพ์ — กรุณาตั้งค่าที่หน้า สติ๊กเกอร์ยา');
      return;
    }
    const allItems = dispenseItems.length ? dispenseItems : (safetyResult?.items ?? []);
    const items = allItems.filter((_: any, i: number) => printSelected.has(i));
    if (!items.length) { toast.error('ไม่ได้เลือกรายการยาสำหรับพิมพ์'); return; }

    const rx = dispenseRx;
    const printedAt = new Date().toLocaleString('th-TH', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Asia/Bangkok',
    });

    console.log('[Print] payload', { rx, items, printerShare });
    setPrintingLabel(true);
    let failed = 0;
    for (const it of items) {
      const label = [
        `${rx.patient_name || 'ไม่ระบุชื่อ'}`,
        `HN: ${rx.hn_number || '-'}   ${printedAt}`,
        `RX: ${rx.prescription_no}`,
        `--------------------`,
        `${it.med_showname || it.med_name}`,
        it.med_name !== (it.med_showname || it.med_name) ? it.med_name : '',
        `จำนวน: ${it.quantity} ${it.unit || ''}  ราคา: ${Number(it.line_total || 0).toFixed(2)} บาท`,
        `ครั้งละ ${it.dose_qty ?? 1} ${it.dose_unit || ''} ${it.route || ''} ${it.frequency || ''}${it.meal_relation ? ` ${it.meal_relation}` : ''}${it.meal_sessions ? ` (${it.meal_sessions.split(',').join(' ')})` : ''}`.trim(),
        `แผนก: ${rx.ward || '-'}`,
      ].filter(Boolean).join('\n');

      try {
        await printerApi.print(label, printerShare);
      } catch {
        failed++;
      }
    }

    setPrintingLabel(false);
    if (failed === 0) {
      toast.success(`พิมพ์ฉลากยา ${items.length} ใบเรียบร้อย`);
    } else {
      toast.error(`พิมพ์สำเร็จ ${items.length - failed}/${items.length} ใบ`);
    }
  };

  // ── Dispense modal inline edit helpers ───────────────────────────────────
  const addDispenseItem = async (drug: any) => {
    if (!drug) return;
    if (dispenseItems.find((i: any) => i.med_sid === drug.med_sid)) { toast('ยานี้มีในรายการแล้ว'); return; }

    // ตรวจสอบล็อตยาและวันหมดอายุ (FEFO)
    const { ok, available } = await validateDrugLots(drug.med_sid, drug.med_showname || drug.med_name);
    if (!ok) return;

    const newItems = [...dispenseItems, {
      item_id: undefined,
      med_sid: drug.med_sid, med_id: drug.med_id,
      med_showname: drug.med_showname || drug.med_name,
      med_name: drug.med_name, quantity: 1,
      dose_qty: 1, dose_unit: drugUnits[0] || 'เม็ด',
      frequency: 'วันละ 1 ครั้ง',
      route: 'รับประทาน', unit: drug.unit || 'เม็ด',
      unit_price: Number(drug.unit_price) || Number(drug.list_selling_price) || 0,
      stock_available: available,
      line_total: 0,
      meal_relation: '', meal_sessions: '',
    }];
    setDispenseItems(newItems);
    setPrintSelected(new Set(newItems.map((_: any, i: number) => i)));
    setDispenseItemsChanged(true);
    setDispenseAddResetKey(k => k + 1);
    if (dispenseRx) runLiveSafety(dispenseRx.patient_id, newItems);
  };

  const SKIP_SAFETY_KEYS = new Set(['quantity', 'dose_qty', 'dose_unit', 'frequency', 'route', 'meal_relation', 'meal_sessions']);
  const updateDispenseItem = (idx: number, k: string, v: any) => {
    const newItems = dispenseItems.map((it: any, i: number) => i === idx ? { ...it, [k]: v } : it);
    setDispenseItems(newItems);
    setDispenseItemsChanged(true);
    if (dispenseRx && !SKIP_SAFETY_KEYS.has(k)) runLiveSafety(dispenseRx.patient_id, newItems);
  };

  const removeDispenseItem = (idx: number) => {
    const newItems = dispenseItems.filter((_: any, i: number) => i !== idx);
    setDispenseItems(newItems);
    setPrintSelected(new Set(newItems.map((_: any, i: number) => i)));
    setDispenseItemsChanged(true);
    if (dispenseRx) runLiveSafety(dispenseRx.patient_id, newItems);
  };

  // ── Toggle pregnancy status ───────────────────────────────────────────────
  const handleTogglePregnancy = async () => {
    if (!dispenseRx?.patient_id || !dispensePatientDetail || updatingPregnancy) return;
    const newVal = !dispensePatientDetail.is_pregnant;
    setDispensePatientDetail((prev: any) => ({ ...prev, is_pregnant: newVal }));
    setUpdatingPregnancy(true);
    try {
      await patientApi.updatePregnancy(dispenseRx.patient_id, newVal);
      safetyApi.check(dispenseRx.prescription_id).then(r => setSafetyResult(r.data)).catch(() => { });
      runLiveSafety(dispenseRx.patient_id, dispenseItems);
    } catch {
      setDispensePatientDetail((prev: any) => ({ ...prev, is_pregnant: !newVal }));
      toast.error('ไม่สามารถบันทึกสถานะตั้งครรภ์ได้');
    } finally {
      setUpdatingPregnancy(false);
    }
  };

  // ── Cancel ────────────────────────────────────────────────────────────────
  const handleCancel = async (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!await confirmDialog({ title: 'ยืนยันยกเลิกใบสั่งยา?', message: 'การยกเลิกไม่สามารถกู้คืนได้', confirmLabel: 'ยกเลิกใบสั่งยา', variant: 'danger' })) return;
    try { await dispenseApi.cancel(id); toast.success('ยกเลิกแล้ว'); loadList(); }
    catch (e: any) { toast.error(e.message); }
  };

  // ── Mock ──────────────────────────────────────────────────────────────────
  const handleMock = async () => {
    setMocking(true);
    try {
      const res = await safetyApi.mock(mockCount);
      const created = res.data.created ?? [];
      const queueList = created.map((c: any) => `${c.queue_number} ${c.patient_name}`).join(', ');
      toast.success(`${res.data.message}${queueList ? ` · คิว: ${queueList}` : ''}`, { duration: 5000 });
      setFStatus('pending'); void Promise.all([loadList(), loadQueue()]);
    } catch (e: any) { toast.error(e.message); }
    finally { setMocking(false); }
  };

  // ── Tab ────────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'prescriptions' | 'dispensed'>('prescriptions');

  // ── Queue tab ──────────────────────────────────────────────────────────────
  const [queueItems, setQueueItems] = useState<any[]>([]);
  const [queueStats, setQueueStats] = useState<any>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueRefreshKey, setQueueRefreshKey] = useState(0);
  const [queueDate, setQueueDate] = useState(() => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }));

  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        queueApi.getQueue({ date: queueDate }),
        queueApi.getStats(),
      ]);
      setQueueItems(listRes.data.data);
      setQueueStats(statsRes.data);
    } catch (e: any) { toast.error(`โหลดคิวไม่ได้: ${e?.message ?? 'unknown'}`); } finally { setQueueLoading(false); }
  }, [queueRefreshKey, queueDate]);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  const handleQueueCall = async (q: any) => {
    try { await queueApi.call(q.queue_id); toast.success(`เรียกคิว ${q.queue_number} แล้ว`); setQueueRefreshKey(k => k + 1); }
    catch (e: any) { toast.error(e.message); }
  };
  const handleQueueComplete = async (q: any) => {
    try { await queueApi.complete(q.queue_id); toast.success(`คิว ${q.queue_number} เสร็จสิ้น`); setQueueRefreshKey(k => k + 1); }
    catch (e: any) { toast.error(e.message); }
  };
  const handleQueueSkip = async (q: any) => {
    try { await queueApi.skip(q.queue_id); toast.success(`ข้ามคิว ${q.queue_number}`); setQueueRefreshKey(k => k + 1); }
    catch (e: any) { toast.error(e.message); }
  };
  const handleQueueReceive = async (q: any) => {
    try {
      await queueApi.receive(q.queue_id, user?.id);
      toast.success(`✅ ยืนยันแล้ว — คิว ${q.queue_number} รับยาเรียบร้อย`);
      setQueueRefreshKey(k => k + 1);
    }
    catch (e: any) { toast.error(e.message); }
  };
  const handleQueueDel = async (q: any) => {
    if (!await confirmDialog({ title: `ลบคิว ${q.queue_number}?`, confirmLabel: 'ลบ', variant: 'danger' })) return;
    try { await queueApi.remove(q.queue_id); toast.success('ลบคิวแล้ว'); setQueueRefreshKey(k => k + 1); }
    catch (e: any) { toast.error(e.message || 'ลบได้เฉพาะคิวที่กำลังรอ'); }
  };

  // lookup: patient_id → queue entry (ใช้ทุก tab)
  const queueByPatient = useMemo(
    () => new Map<number, any>(queueItems.map(q => [q.patient_id, q])),
    [queueItems]
  );

  // เรียงใบสั่งยาตามหมายเลขคิว มากไปน้อย (A004 → A001) ไม่มีคิวอยู่ท้ายสุด
  const sortedRxList = useMemo(() =>
    [...rxList].sort((a, b) => {
      const qa = a.patient_id != null ? queueByPatient.get(a.patient_id) : undefined;
      const qb = b.patient_id != null ? queueByPatient.get(b.patient_id) : undefined;
      const na = qa ? parseInt(qa.queue_number.replace(/\D/g, ''), 10) : -1;
      const nb = qb ? parseInt(qb.queue_number.replace(/\D/g, ''), 10) : -1;
      return nb - na;
    }),
    [rxList, queueByPatient]
  );

  // ── Dispensed tab ──────────────────────────────────────────────────────────
  const [dispensedList, setDispensedList] = useState<any[]>([]);
  const [dispensedTotal, setDispensedTotal] = useState(0);
  const [dispensedLoading, setDispensedLoading] = useState(false);
  const [dispensedPage, setDispensedPage] = useState(1);
  const [dispensedSearch, setDispensedSearch] = useState('');
  const todayTH = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
  const [dispensedDateFrom, setDispensedDateFrom] = useState(todayTH);
  const [dispensedDateTo, setDispensedDateTo] = useState(todayTH);

  const loadDispensed = useCallback(async () => {
    setDispensedLoading(true);
    try {
      const res = await dispenseApi.getAll({
        status: 'dispensed',
        search: dispensedSearch || undefined,
        date_from: dispensedDateFrom || undefined,
        date_to: dispensedDateTo || undefined,
        page: dispensedPage,
        limit: 40,
      });
      setDispensedList(res.data.data ?? []);
      setDispensedTotal(res.data.total ?? 0);
    } catch (e: any) {
      console.error('[loadDispensed]', e);
      toast.error(`โหลดรายการจ่ายยาไม่ได้: ${e.message}`);
    } finally { setDispensedLoading(false); }
  }, [dispensedSearch, dispensedDateFrom, dispensedDateTo, dispensedPage]);

  useEffect(() => { if (tab === 'dispensed') loadDispensed(); }, [tab, loadDispensed]);

  // ── Safety icon helper ────────────────────────────────────────────────────
  const totalLiveCritical = Object.values(liveAlerts).flat().filter(a => a.level === 'critical').length;
  const totalLiveWarn = Object.values(liveAlerts).flat().filter(a => a.level === 'warning').length;
  const allLiveAlerts = Object.values(liveAlerts).flat();
  const totalPages = Math.ceil(total / perPage);

  return (
    <MainLayout title="จ่ายยา"
      subtitle={tab === 'prescriptions' ? `${total.toLocaleString()} ใบสั่งยา` : `${dispensedTotal.toLocaleString()} รายการ`}
      actions={
        tab === 'prescriptions' ? (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 border border-dashed border-slate-300 rounded-lg px-2 py-1">
              <Wand2 size={13} className="text-slate-400" />
              <select value={mockCount} onChange={e => setMockCount(Number(e.target.value))}
                className="text-xs text-slate-600 outline-none bg-transparent">
                {[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}
              </select>
              <Button variant="secondary" size="sm" onClick={handleMock} loading={mocking}>สุ่มผู้ป่วย</Button>
            </div>
            <Button onClick={() => { resetForm(); setShowCreate(true); }} icon={<Plus size={14} />}>สร้างใบสั่งยา</Button>
          </div>
        ) : null
      }>

      {/* ── Tab bar + Filters ── */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex gap-1 bg-slate-200 p-1 rounded-xl flex-shrink-0">
          {DISPENSE_TABS.map(({ key, label, icon }) => (
            <button key={key} onClick={() => setTab(key as any)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === key ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {icon}{label}
            </button>
          ))}
        </div>

        {tab === 'prescriptions' && (
          <Card className="flex-1 min-w-0 !p-3">
            <div className="flex gap-2 flex-wrap items-center">
              <div className="flex-1 min-w-44">
                <Input placeholder="เลขใบสั่ง, ชื่อผู้ป่วย, HN..."
                  value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
              </div>
              <Select placeholder="ทุกสถานะ" value={fStatus}
                onChange={e => { setFStatus(e.target.value); setPage(1); }}
                options={Object.entries(STATUS_TH).map(([v, l]) => ({ value: v, label: l }))} />
              <Input placeholder="แผนก..." value={fWard}
                onChange={e => { setFWard(e.target.value); setPage(1); }} className="w-28" />
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-slate-500 whitespace-nowrap">คิววันที่</label>
                <input type="date" value={queueDate} onChange={e => setQueueDate(e.target.value)}
                  className="h-9 border border-slate-200 shadow-sm rounded-lg px-2 text-sm outline-none focus:ring-2 focus:ring-primary-400 bg-white" />
              </div>
              <button onClick={loadList} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </Card>
        )}

        {tab === 'dispensed' && (
          <Card className="flex-1 min-w-0 !p-3">
            <div className="flex gap-2 flex-wrap items-center">
              <div className="flex-1 min-w-44">
                <Input placeholder="เลขใบสั่ง, ชื่อผู้ป่วย, HN..."
                  value={dispensedSearch} onChange={e => { setDispensedSearch(e.target.value); setDispensedPage(1); }} />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-slate-500 whitespace-nowrap">จากวันที่</label>
                <input type="date" value={dispensedDateFrom} onChange={e => { setDispensedDateFrom(e.target.value); setDispensedPage(1); }}
                  className="h-9 border border-slate-200 shadow-sm rounded-lg px-2 text-sm outline-none focus:ring-2 focus:ring-primary-400 bg-white" />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-slate-500 whitespace-nowrap">ถึงวันที่</label>
                <input type="date" value={dispensedDateTo} onChange={e => { setDispensedDateTo(e.target.value); setDispensedPage(1); }}
                  className="h-9 border border-slate-200 shadow-sm rounded-lg px-2 text-sm outline-none focus:ring-2 focus:ring-primary-400 bg-white" />
              </div>
              <button onClick={loadDispensed} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <RefreshCw size={14} className={dispensedLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </Card>
        )}
      </div>

      {/* ══ PRESCRIPTIONS TAB ══════════════════════════════════════════════════ */}
      {tab === 'prescriptions' && <>

        {/* ── List ── */}
        <Card className="overflow-hidden p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Spinner size={28} /></div>
          ) : rxList.length === 0 ? (
            <EmptyState icon={<Package size={36} />} title="ไม่พบใบสั่งยา"
              description={fStatus === 'pending' ? 'กดปุ่ม "สุ่มผู้ป่วย" เพื่อสร้างข้อมูลทดสอบ' : ''} />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>{['ลำดับที่', 'วันที่', 'เวลา', 'ผู้ป่วย', 'แผนก', 'แพทย์', 'สถานะ', 'รายการ', 'ยอดรวม', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 last:text-right whitespace-nowrap">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sortedRxList.map(rx => {
                      const rxq = rx.patient_id != null ? queueByPatient.get(rx.patient_id) : undefined;
                      return (
                        <tr key={rx.prescription_id} className="table-row-hover cursor-pointer"
                          onClick={() => openDispense(rx)}>
                          <td className="px-4 py-3 font-mono text-sm font-bold text-slate-600 whitespace-nowrap">
                            {rxq
                              ? rxq.queue_number
                              : (rx as any).queue_number
                                ? (rx as any).queue_number
                                : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                            {fmtDate(rx.created_at)}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                            {fmtTime(rx.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800">{rx.patient_name || 'ไม่ระบุ'}</p>
                            <p className="text-xs text-slate-400">{rx.hn_number}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-slate-700">{rx.ward || '-'}</p>
                            {(rx as any).diagnosis && (
                              <p className="text-[10px] text-slate-400 truncate max-w-[140px]">{(rx as any).diagnosis}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">{rx.doctor_name || '-'}</td>
                          <td className="px-4 py-3">
                            <Badge variant={STATUS_COLOR[rx.status] ?? 'gray'} dot>{STATUS_TH[rx.status] ?? rx.status}</Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{rx.item_count ?? '-'} รายการ</td>
                          <td className="px-4 py-3 text-xs font-medium text-slate-700 whitespace-nowrap">
                            {Number(rx.total_cost) > 0
                              ? `${Number(rx.total_cost).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                              {rx.status === 'pending' && (
                                <>
                                  <button onClick={() => openDispense(rx)}
                                    className="px-2.5 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-medium hover:bg-primary-700 transition-colors">
                                    จ่ายยา
                                  </button>
                                  <button onClick={e => handleCancel(rx.prescription_id, e)}
                                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs hover:bg-red-50 hover:text-red-600 transition-colors">
                                    ยกเลิก
                                  </button>
                                </>
                              )}
                              {rx.status === 'dispensed' && rxq && (
                                <button
                                  onClick={e => { e.stopPropagation(); handleQueueCall(rxq); }}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-medium transition-colors"
                                  title={`เรียกคิว ${rxq.queue_number}`}
                                >
                                  <PhoneCall size={13} /> เรียกคิว
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500">หน้า {page}/{totalPages} · {total.toLocaleString()} รายการ</p>
                  <div className="flex gap-1">
                    <Button variant="secondary" size="xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>◀</Button>
                    <Button variant="secondary" size="xs" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>▶</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

      </> /* end prescriptions tab */}

      {/* ══ DISPENSED TAB ════════════════════════════════════════════════════════ */}
      {tab === 'dispensed' && (
        <div className="space-y-4">
          <Card className="overflow-hidden p-0">
            {dispensedLoading ? (
              <div className="flex justify-center py-12"><Spinner size={24} /></div>
            ) : dispensedList.length === 0 ? (
              <EmptyState icon={<ClipboardCheck size={36} />} title="ยังไม่มีรายการจ่ายยา" description="" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>{['ลำดับที่', 'ผู้ป่วย', 'HN', 'เลขใบสั่ง', 'แผนก', 'รายการ', 'ผู้จ่าย', 'วันที่จ่าย', 'เวลาจ่าย', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap last:text-right">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {dispensedList.map(rx => {
                        const dq = queueByPatient.get(rx.patient_id);
                        return (
                          <tr key={rx.prescription_id} className="table-row-hover">
                            <td className="px-4 py-3 font-mono font-bold text-primary-700">
                              {(rx as any).queue_number
                                ? <span className={`text-xs px-1.5 py-0.5 rounded-md ${dq ? (QUEUE_STATUS[dq.status]?.badge ?? 'bg-slate-100 text-slate-500') : 'bg-slate-100 text-slate-500'}`}>{(rx as any).queue_number}</span>
                                : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800">{rx.patient_name || 'ไม่ระบุ'}</td>
                            <td className="px-4 py-3 text-xs font-mono text-slate-500">{rx.hn_number || '—'}</td>
                            <td className="px-4 py-3 text-xs font-mono text-primary-700">{rx.prescription_no}</td>
                            <td className="px-4 py-3 text-xs text-slate-600">{rx.ward || '—'}</td>
                            <td className="px-4 py-3 text-xs text-slate-500">{rx.item_count ?? '—'} รายการ</td>
                            <td className="px-4 py-3 text-xs text-slate-600">{rx.dispensed_by_name || '—'}</td>
                            <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                              {fmtDate(rx.dispensed_at)}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                              {fmtTime(rx.dispensed_at)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {dq && (dq.status === 'waiting' || dq.status === 'called') && (
                                  <button
                                    onClick={e => { e.stopPropagation(); handleQueueCall(dq); }}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-medium transition-colors"
                                    title={`เรียกคิว ${dq.queue_number}`}
                                  >
                                    <PhoneCall size={12} /> เรียกคิว {dq.queue_number}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {Math.ceil(dispensedTotal / 40) > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                    <p className="text-xs text-slate-500">หน้า {dispensedPage}/{Math.ceil(dispensedTotal / 40)} · {dispensedTotal.toLocaleString()} รายการ</p>
                    <div className="flex gap-1">
                      <Button variant="secondary" size="xs" disabled={dispensedPage === 1} onClick={() => setDispensedPage(p => p - 1)}>◀</Button>
                      <Button variant="secondary" size="xs" disabled={dispensedPage >= Math.ceil(dispensedTotal / 40)} onClick={() => setDispensedPage(p => p + 1)}>▶</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          CREATE / EDIT MODAL
      ════════════════════════════════════════════════════════════════════ */}
      <Modal open={showCreate}
        onClose={() => { setShowCreate(false); resetForm(); }}
        size="2xl"
        title={editingRxId ? `แก้ไขใบสั่งยา` : 'สร้างใบสั่งยาใหม่'}
        footer={
          <div className="flex items-center justify-between w-full">
            {/* Live safety summary */}
            <div className="flex items-center gap-4">
              {loadingSafety
                ? <span className="flex items-center gap-1 text-xs text-slate-400"><Loader2 size={12} className="animate-spin" />ตรวจสอบยา...</span>
                : <InlineSafetyBadge alerts={allLiveAlerts} />
              }
              {!editingRxId && (
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                  <input type="checkbox" checked={addToQueue} onChange={e => setAddToQueue(e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded" />
                  ออกคิวรับยา
                </label>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { setShowCreate(false); resetForm(); }}>ยกเลิก</Button>
              <Button
                onClick={handleSave}
                loading={saving}
                disabled={loadingSafety || allLiveAlerts.some(a => a.type === 'allergy' || a.type === 'interaction')}
                variant={allLiveAlerts.some(a => a.type === 'allergy' || a.type === 'interaction') ? 'danger' : 'primary'}
              >
                {allLiveAlerts.some(a => a.type === 'allergy' || a.type === 'interaction') ? '⛔ ไม่สามารถบันทึกได้' : 'บันทึก'}
              </Button>
            </div>
          </div>
        }>
        <div className="grid grid-cols-[2fr_5fr] gap-6 min-h-0">

          {/* ══ LEFT: ข้อมูลผู้ป่วย ══════════════════════════════════ */}
          <div className="space-y-4 overflow-y-auto pr-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">ข้อมูลผู้ป่วย</p>
            <div className="space-y-3">
              <div>
                <SearchSelect type="patient" label="ผู้ป่วย" required
                  initialDisplay={patientLabel} resetKey={resetKey}
                  onSelect={p => { setPatientId(p?.patient_id ?? 0); setPatientLabel(p?.full_name ?? ''); setPatientTreatmentRight(p?.treatment_right ?? null); setPatientTreatmentRightNote(p?.treatment_right_note ?? null); if (formErrors.patient_id) setFormErrors(prev => ({ ...prev, patient_id: '' })); }} />
                {formErrors.patient_id && <p className="mt-1 text-xs text-red-500">{formErrors.patient_id}</p>}
              </div>
              <SearchSelect type="user" label="แพทย์ผู้สั่ง"
                initialDisplay={doctorLabel} resetKey={resetKey}
                onSelect={u => { setDoctorId(u?.uid ?? 0); setDoctorLabel(u?.full_name ?? ''); }} />
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1.5">แผนก <span className="text-red-400">*</span></label>
                <input value={ward} onChange={e => { setWard(e.target.value); if (formErrors.ward) setFormErrors(p => ({ ...p, ward: '' })); }}
                  placeholder="OPD, IPD, ER, ICU..."
                  className={`w-full h-9 border rounded-lg text-sm px-3 outline-none focus:ring-2 focus:ring-primary-100 ${formErrors.ward ? 'border-red-400 focus:border-red-400' : 'border-slate-200 focus:border-primary-500'}`} />
                {formErrors.ward && <p className="mt-1 text-xs text-red-500">{formErrors.ward}</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1.5">คำวินิจฉัย</label>
                <input value={diagnosis} onChange={e => setDiagnosis(e.target.value)}
                  placeholder="เช่น J06.9, HT, DM Type 2..."
                  className="w-full h-9 border border-slate-200 rounded-lg text-sm px-3 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1.5">หมายเหตุจากแพทย์</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                  placeholder="เช่น อาการแพ้ยาที่ยังไม่ยืนยัน, กำลังตั้งครรภ์..."
                  className="w-full border border-slate-200 rounded-lg text-sm px-3 py-2 outline-none focus:border-primary-500 resize-none" />
              </div>
            </div>

            {/* Patient Demographics Panel */}
            {patientId > 0 && (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                {createAllergyLoading ? (
                  <div className="px-4 py-2 bg-slate-50 flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 size={12} className="animate-spin" /> กำลังตรวจสอบแพ้ยา...
                  </div>
                ) : createAllergies.length > 0 ? (
                  <div className="px-4 py-2.5 bg-red-500 text-white flex items-start gap-2">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                    <div>
                      <span className="text-sm font-bold">แพ้ยา: </span>
                      <span className="text-sm">{createAllergies.map(a => a.med_name || a.drug_name || '').filter(Boolean).join(' · ')}</span>
                      {createAllergies.some(a => a.symptoms) && (
                        <p className="text-xs mt-0.5 text-red-100">อาการ: {createAllergies.map(a => a.symptoms).filter(Boolean).join('; ')}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-2 bg-green-50 flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-green-500" />
                    <span className="text-xs text-green-700 font-medium">ไม่มีประวัติแพ้ยา</span>
                  </div>
                )}
                {createPatientDetail && (
                  <div className="px-4 py-3 space-y-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      <div><span className="text-slate-400">HN: </span><span className="font-mono font-semibold text-slate-700">{createPatientDetail.hn_number}</span></div>
                      <div><span className="text-slate-400">เพศ: </span><span>{createPatientDetail.gender == 'M' ? 'ชาย' : createPatientDetail.gender == 'F' ? 'หญิง' : '—'}</span></div>
                      <div><span className="text-slate-400">อายุ: </span><span>{createPatientDetail.age_y ?? '—'} ปี {createPatientDetail.age_m ?? ''} เดือน</span></div>
                      <div><span className="text-slate-400">หมู่เลือด: </span><span className="font-semibold">{createPatientDetail.blood_group?.trim() || '—'}</span></div>
                      <div><span className="text-slate-400">บัตรปชช.: </span><span className="font-mono">{createPatientDetail.national_id || '—'}</span></div>
                      <div><span className="text-slate-400">เบอร์โทร: </span><span>{createPatientDetail.phone || '—'}</span></div>
                      <div className="col-span-2"><span className="text-slate-400">สิทธิ์: </span><span className="font-medium">{treatmentRightLabel(patientTreatmentRight, patientTreatmentRightNote) ?? '—'}</span></div>
                      {createPatientDetail.PMH && (
                        <div className="col-span-2"><span className="text-slate-400">โรคประจำตัว: </span><span className="text-slate-700">{createPatientDetail.PMH}</span></div>
                      )}
                      <div><span className="text-slate-400">น้ำหนัก: </span><span>{createPatientDetail.weight ? `${createPatientDetail.weight} kg` : '—'}</span></div>
                      <div><span className="text-slate-400">ส่วนสูง: </span><span>{createPatientDetail.height ? `${createPatientDetail.height} cm` : '—'}</span></div>
                      <div><span className="text-slate-400">BMI: </span><span>{createPatientDetail.bmi ? Number(createPatientDetail.bmi).toFixed(1) : '—'}</span></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                      <div className="text-xs">
                        <label className="text-slate-400 block mb-1">Temp (°C)</label>
                        <input value={createVitals.temp} onChange={e => setCreateVitals(v => ({ ...v, temp: e.target.value }))}
                          placeholder="36.5" className="w-full h-7 border border-slate-200 rounded-lg px-2 outline-none focus:border-primary-400 text-xs" />
                      </div>
                      <div className="text-xs">
                        <label className="text-slate-400 block mb-1">BP (mmHg)</label>
                        <input value={createVitals.bp} onChange={e => setCreateVitals(v => ({ ...v, bp: e.target.value }))}
                          placeholder="120/80" className="w-full h-7 border border-slate-200 rounded-lg px-2 outline-none focus:border-primary-400 text-xs" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ══ RIGHT: รายการยา ══════════════════════════════════════ */}
          <div className="space-y-4 overflow-y-auto pl-1 border-l border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">รายการยา</p>
            <SearchSelect type="subwarehouse" label="" resetKey={resetKey}
              initialDisplay="" onSelect={d => { if (d) { addItem(d); if (formErrors.items) setFormErrors(p => ({ ...p, items: '' })); } }}
              placeholder="พิมพ์ชื่อยาเพื่อเพิ่มในรายการ..." />
            {formErrors.items && <p className="mt-1.5 text-xs text-red-500">{formErrors.items}</p>}

            {items.length > 0 && (
              <div className={`rounded-xl border px-4 py-3 ${loadingSafety ? 'bg-slate-50 border-slate-200' :
                allLiveAlerts.some(a => a.level === 'critical') ? 'bg-red-50 border-red-200' :
                  allLiveAlerts.some(a => a.level === 'warning') ? 'bg-amber-50 border-amber-200' :
                    'bg-green-50 border-green-200'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {loadingSafety
                    ? <><Loader2 size={13} className="animate-spin text-slate-400" /><span className="text-xs text-slate-500">กำลังตรวจสอบความปลอดภัย...</span></>
                    : allLiveAlerts.some(a => a.level === 'critical')
                      ? <><ShieldX size={14} className="text-red-600" /><span className="text-xs font-semibold text-red-800">⛔ พบปัญหาร้ายแรง {allLiveAlerts.filter(a => a.level === 'critical').length} รายการ</span></>
                      : allLiveAlerts.some(a => a.level === 'warning')
                        ? <><ShieldAlert size={14} className="text-amber-600" /><span className="text-xs font-semibold text-amber-800">⚠ พบข้อควรระวัง {allLiveAlerts.length} รายการ</span></>
                        : <><ShieldCheck size={14} className="text-green-600" /><span className="text-xs font-semibold text-green-800">✓ ผ่านการตรวจความปลอดภัย</span></>
                  }
                  {!patientId && !loadingSafety && (
                    <span className="text-[11px] text-slate-400 ml-auto">* ยังไม่ได้เลือกผู้ป่วย</span>
                  )}
                </div>
                {allLiveAlerts.length > 0 && (
                  <div className="space-y-1.5 mt-2.5 max-h-32 overflow-y-auto">
                    {allLiveAlerts.map((a, i) => (
                      <div key={i} className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${a.level === 'critical' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                        <span className="shrink-0 mt-0.5">{a.level === 'critical' ? '⛔' : '⚠'}</span>
                        <div><p className="font-semibold">{a.title}</p>{a.detail && <p className="opacity-75 mt-0.5">{a.detail}</p>}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {items.length > 0 && (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5 text-center font-semibold text-slate-500 w-6">#</th>
                      {['ชื่อยา', 'จำนวน', 'วิธีใช้', 'ราคา (บาท)', ''].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <DrugRow key={idx} item={it} idx={idx}
                        drugUnits={drugUnits}
                        alerts={liveAlerts[it.med_sid] ?? []}
                        onUpdate={(k, v) => updateItem(idx, k, v)}
                        onRemove={() => removeItem(idx)} />
                    ))}
                  </tbody>
                </table>
                {items.some(it => it.unit_price > 0) && (
                  <div className="flex justify-end items-center gap-2 px-4 py-2.5 border-t border-slate-100 bg-slate-50">
                    <span className="text-xs text-slate-500">ยอดรวม</span>
                    <span className="text-sm font-bold text-primary-700">
                      {items.reduce((s, it) => s + it.unit_price * it.quantity, 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════════
          DISPENSE CONFIRM MODAL (พร้อม full safety check)
      ════════════════════════════════════════════════════════════════════ */}
      {dispenseRx && (
        <Modal open onClose={() => { setDispenseRx(null); setSafetyResult(null); setDispenseItems([]); setPrintSelected(new Set()); setPendingOverdueIds(new Set()); setDispenseItemsChanged(false); setDispenseMetaChanged(false); setLiveAlerts({}); setDispensePatientDetail(null); }} size="full"
          title={`จ่ายยา — ${dispenseRx.prescription_no}${(dispenseItemsChanged || dispenseMetaChanged) ? ' ✏️' : ''}`}
          footer={
            <div className="flex items-center justify-between w-full">
              <Button
                variant="secondary"
                icon={<Printer size={14} />}
                onClick={handlePrintLabel}
                loading={printingLabel}
                disabled={!safetyResult}
                title={safetyResult ? 'พิมพ์รายการยา' : 'รอโหลดข้อมูลยา...'}
              >
                พิมพ์รายการยา
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => { setDispenseRx(null); setSafetyResult(null); setDispenseItems([]); setPrintSelected(new Set()); setPendingOverdueIds(new Set()); setDispenseItemsChanged(false); setDispenseMetaChanged(false); setLiveAlerts({}); setDispensePatientDetail(null); }}>ยกเลิก</Button>
                <Button
                  onClick={handleDispense} loading={dispensing}
                  disabled={
                    dispenseItems.length === 0 ||
                    (dispenseItemsChanged
                      ? Object.values(liveAlerts).flat().some((a: any) => (a.type === 'allergy' || a.type === 'interaction') && a.level === 'critical')
                      : (!safetyResult || filteredAlertLevel === 'critical')) ||
                    dispenseItems.some((it: any) => Number(it.stock_available) < Number(it.quantity) && !pendingOverdueIds.has(it.item_id) && it.item_id !== undefined)
                  }
                  variant={(dispenseItemsChanged ? Object.values(liveAlerts).flat().some((a: any) => a.level === 'critical') : filteredAlertLevel === 'critical') ? 'danger' : 'primary'}>
                  {(dispenseItemsChanged || dispenseMetaChanged) ? '💾 บันทึก + ยืนยันจ่ายยา' : '✓ ยืนยันจ่ายยา'}
                </Button>
              </div>
            </div>
          }>
          <div className="grid grid-cols-[2fr_5fr] gap-6 min-h-0">

            {/* ══ LEFT: Patient card ════════════════════════════════════════ */}
            <div className="space-y-0 overflow-y-auto pr-1">
              <div className="rounded-xl border border-slate-200 overflow-hidden">

                {/* identity row */}
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <img
                    src={`/images/patient_image/${dispenseRx.patient_photo || 'user.png'}`}
                    alt={dispenseRx.patient_name || 'ผู้ป่วย'}
                    onError={(e) => { (e.target as HTMLImageElement).src = '/images/patient_image/user.png'; }}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white shadow flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800 truncate">{dispenseRx.patient_name || 'ไม่ระบุ'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">HN: <span className="font-mono">{dispenseRx.hn_number || '—'}</span> · RX: <span className="font-mono text-primary-600">{dispenseRx.prescription_no}</span></p>
                  </div>
                </div>

                {/* allergy banner */}
                {dispenseAllergies.length > 0 ? (
                  <div className="px-4 py-2.5 bg-red-500 text-white flex items-start gap-2">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                    <div>
                      <span className="text-sm font-bold">แพ้ยา: </span>
                      <span className="text-sm">{dispenseAllergies.map((a: any) => a.med_name || '').filter(Boolean).join(' · ')}</span>
                      {dispenseAllergies.some((a: any) => a.symptoms) && (
                        <p className="text-xs mt-0.5 text-red-100">
                          อาการ: {dispenseAllergies.map((a: any) => a.symptoms).filter(Boolean).join('; ')}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-2 bg-green-50 flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-green-500" />
                    <span className="text-xs text-green-700 font-medium">ไม่มีประวัติแพ้ยา</span>
                  </div>
                )}

                {/* demographics + vitals */}
                {dispensePatientDetail && (
                  <div className="px-4 pt-3 space-y-3">
                    <div className="grid grid-cols-4 gap-x-4 gap-y-1.5 text-xs">
                      <div><span className="text-slate-400">เพศ: </span><span className="font-medium">{(dispensePatientDetail.gender || (dispenseRx as any)?.gender) === 'M' ? 'ชาย' : (dispensePatientDetail.gender || (dispenseRx as any)?.gender) === 'F' ? 'หญิง' : '—'}</span></div>
                      <div><span className="text-slate-400">อายุ: </span><span className="font-medium">{dispensePatientDetail.age_y ?? '—'} ปี {dispensePatientDetail.age_m ?? ''} เดือน</span></div>
                      <div><span className="text-slate-400">หมู่เลือด: </span><span className="font-bold text-red-700">{dispensePatientDetail.blood_group?.trim() || '—'}</span></div>
                      <div><span className="text-slate-400">โทร: </span><span>{dispensePatientDetail.phone || '—'}</span></div>
                      <div className="col-span-2"><span className="text-slate-400">บัตรปชช.: </span><span className="font-mono">{dispensePatientDetail.national_id || '—'}</span></div>
                      <div className="col-span-2"><span className="text-slate-400">สิทธิ์: </span><span className="font-medium">{treatmentRightLabel((dispenseRx as any).treatment_right, (dispenseRx as any).treatment_right_note) ?? '—'}</span></div>
                      {dispensePatientDetail.PMH && (
                        <div className="col-span-4"><span className="text-slate-400">โรคประจำตัว: </span><span className="text-slate-700">{dispensePatientDetail.PMH}</span></div>
                      )}
                      {(dispensePatientDetail.gender || (dispenseRx as any)?.gender) === 'F' && (
                        <div className="col-span-4 flex items-center gap-2 pt-0.5">
                          <span className="text-slate-400">สถานะตั้งครรภ์:</span>
                          <button
                            onClick={handleTogglePregnancy}
                            disabled={updatingPregnancy}
                            className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors disabled:opacity-50 ${dispensePatientDetail.is_pregnant
                              ? 'bg-pink-100 text-pink-700 hover:bg-pink-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              }`}
                          >
                            🤰 {dispensePatientDetail.is_pregnant ? 'ตั้งครรภ์' : 'ไม่ตั้งครรภ์'}
                          </button>
                        </div>
                      )}
                      <div><span className="text-slate-400">น้ำหนัก: </span><span>{dispensePatientDetail.weight ? `${dispensePatientDetail.weight} kg` : '—'}</span></div>
                      <div><span className="text-slate-400">ส่วนสูง: </span><span>{dispensePatientDetail.height ? `${dispensePatientDetail.height} cm` : '—'}</span></div>
                      <div><span className="text-slate-400">BMI: </span><span>{dispensePatientDetail.bmi ? Number(dispensePatientDetail.bmi).toFixed(1) : '—'}</span></div>
                    </div>
                  </div>
                )}

                {/* prescription meta — ต่อจาก demographics ในการ์ดเดียวกัน */}
                <div className="px-4 py-3 border-t border-slate-100 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1.5">แพทย์ผู้สั่ง</label>
                    <SearchSelect type="user" label="" resetKey={dispenseMetaResetKey}
                      initialDisplay={dispenseDoctorLabel}
                      onSelect={u => { setDispenseDoctorId(u?.uid ?? null); setDispenseDoctorLabel(u?.full_name ?? ''); setDispenseMetaChanged(true); }} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1.5">แผนก <span className="text-red-400">*</span></label>
                    <input value={dispenseWard} onChange={e => { setDispenseWard(e.target.value); setDispenseMetaChanged(true); }}
                      placeholder="OPD, IPD, ER, ICU..."
                      className="w-full h-9 border border-slate-200 rounded-lg text-sm px-3 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1.5">คำวินิจฉัย</label>
                    <input value={dispenseDiagnosis} onChange={e => { setDispenseDiagnosis(e.target.value); setDispenseMetaChanged(true); }}
                      placeholder="เช่น J06.9, HT, DM Type 2..."
                      className="w-full h-9 border border-slate-200 rounded-lg text-sm px-3 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1.5">หมายเหตุจากแพทย์</label>
                    <textarea value={dispenseNote} onChange={e => { setDispenseNote(e.target.value); setDispenseMetaChanged(true); }}
                      rows={2} placeholder="เช่น กำลังตั้งครรภ์, แพ้ยาที่ยังไม่ยืนยัน..."
                      className="w-full border border-slate-200 rounded-lg text-sm px-3 py-2 outline-none focus:border-primary-500 resize-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* ══ RIGHT: รายการยา ══════════════════════════════════════════ */}
            <div className="space-y-3 overflow-y-auto pl-1 border-l border-slate-100">

              {/* safety panel — ใช้ live alerts เมื่อรายการยาถูกแก้ไข */}
              {loadingSafety && dispenseItemsChanged && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 border border-slate-200">
                  <Loader2 size={13} className="animate-spin text-slate-400" />
                  <span className="text-xs text-slate-500">กำลังตรวจสอบความปลอดภัย...</span>
                </div>
              )}
              <SafetyPanel
                prescriptionId={dispenseRx.prescription_id}
                onLoaded={r => setSafetyResult(r)}
                overrideAlerts={
                  dispenseItemsChanged
                    ? Object.values(liveAlerts).flat() as SafetyAlert[]
                    : filteredSafetyAlerts
                } />

              {/* หมายเหตุจากแพทย์ banner */}
              {dispenseNote && (
                <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                  <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-900 whitespace-pre-line">{dispenseNote}</p>
                </div>
              )}

              {/* เพิ่มยา */}
              <SearchSelect
                type="subwarehouse" label="" resetKey={dispenseAddResetKey}
                initialDisplay="" onSelect={d => { if (d) addDispenseItem(d); }}
                placeholder="พิมพ์ชื่อยาเพื่อเพิ่มในรายการ..."
              />

              {/* ตารางยา */}
              {dispenseItems.length > 0 && (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-2 py-2 text-center text-xs font-semibold text-slate-500 w-8">
                          <input type="checkbox" className="rounded accent-primary-600"
                            checked={printSelected.size === dispenseItems.length}
                            onChange={e => setPrintSelected(e.target.checked ? new Set(dispenseItems.map((_, i) => i)) : new Set())}
                          />
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">ยา</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold text-slate-500">จำนวน</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold text-slate-500">วิธีใช้</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold text-slate-500">ราคา</th>
                        <th className="w-5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dispenseItems.map((it: any, i: number) => {
                        const unitPrice = Number(it.unit_price) || 0;
                        const qty = Number(it.quantity);
                        const lineTotal = unitPrice * qty;
                        const isExpired = it.is_expired || (it.exp_date && new Date(it.exp_date) < new Date());
                        const stockAvail = Math.max(0, Number(it.stock_available));
                        const isLowStock = it.item_id !== undefined && stockAvail < qty;
                        const isZeroStock = it.item_id !== undefined && stockAvail === 0;
                        const overdueQty = Math.max(0, qty - stockAvail);
                        const isOverdue = pendingOverdueIds.has(it.item_id);
                        const checked = printSelected.has(i);
                        return (
                          <tr key={i} className={`${isExpired ? 'bg-red-50' : (isLowStock && !isOverdue) ? 'bg-amber-50' : isOverdue ? 'bg-slate-50 opacity-60' : ''}`}>
                            <td className="px-2 py-2 text-center cursor-pointer" onClick={() => setPrintSelected(prev => {
                              const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next;
                            })}>
                              <input type="checkbox" className="rounded accent-primary-600" checked={checked} readOnly />
                            </td>
                            {/* ชื่อยา */}
                            <td className="px-3 py-2">
                              <p className={`text-sm font-semibold leading-snug ${isOverdue ? 'line-through text-slate-400' : 'text-slate-800'}`}>{it.med_showname || it.med_name}</p>
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {isExpired && <span className="text-[9px] bg-red-100 text-red-700 px-1 py-0.5 rounded-full font-medium">⛔ หมดอายุ</span>}
                                {!isExpired && isLowStock && !isOverdue && (
                                  isZeroStock
                                    ? <span className="text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded-full font-medium">⚠ หมดสต็อก</span>
                                    : <span className="text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded-full font-medium">⚠ {stockAvail}/{qty}</span>
                                )}
                                {isOverdue && <span className="text-[9px] bg-orange-100 text-orange-700 px-1 py-0.5 rounded-full font-medium">ค้างจ่าย {overdueQty}</span>}
                                {it.med_severity?.includes('เสพติด') && <span className="text-[9px] bg-purple-100 text-purple-700 px-1 py-0.5 rounded-full font-medium">เสพติด</span>}
                                {it.med_pregnancy_category === 'X' && <span className="text-[9px] bg-red-100 text-red-700 px-1 py-0.5 rounded-full font-medium">Preg X</span>}
                              </div>
                              {!isExpired && isLowStock && !isOverdue && (
                                <div className="mt-1.5 flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                                  <span className="text-[10px] text-amber-800 leading-snug flex-1">
                                    {isZeroStock ? <>ยาหมด — ค้างจ่าย <strong>{overdueQty} {it.unit}</strong>?</> : <>สต็อก {stockAvail} — ค้างจ่าย <strong>{overdueQty}</strong>?</>}
                                  </span>
                                  <button className="shrink-0 text-[10px] bg-amber-500 hover:bg-amber-600 text-white px-2 py-0.5 rounded font-semibold"
                                    onClick={() => setPendingOverdueIds(prev => new Set([...prev, it.item_id]))}>บันทึก</button>
                                </div>
                              )}
                              {isOverdue && (
                                <div className="mt-1 flex items-center gap-1">
                                  <span className="text-[10px] text-orange-600 font-medium">{stockAvail > 0 ? `จ่าย ${stockAvail}` : `ค้างทั้งหมด`}</span>
                                  <button className="text-[10px] text-slate-400 hover:text-red-500 underline"
                                    onClick={() => setPendingOverdueIds(prev => { const n = new Set(prev); n.delete(it.item_id); return n; })}>เลิก</button>
                                </div>
                              )}
                            </td>
                            {/* จำนวน */}
                            <td className="px-2 py-2 whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <input type="number" min="1" value={it.quantity}
                                  onChange={e => updateDispenseItem(i, 'quantity', Number(e.target.value))}
                                  className="w-14 h-7 border border-slate-200 rounded text-xs px-1 outline-none focus:border-primary-500 text-center" />
                                <span className="text-xs text-slate-400">{it.unit}</span>
                              </div>
                            </td>
                            {/* วิธีใช้ */}
                            <td className="px-2 py-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <select value={it.route || 'รับประทาน'} onChange={e => updateDispenseItem(i, 'route', e.target.value)}
                                  className="h-7 border border-slate-200 rounded text-xs px-1 outline-none bg-white focus:border-primary-500">
                                  {ROUTE.map(o => <option key={o}>{o}</option>)}
                                </select>
                                <input type="number" min="0.25" step="0.25" value={it.dose_qty || 1}
                                  onChange={e => updateDispenseItem(i, 'dose_qty', parseFloat(e.target.value) || 1)}
                                  className="w-14 h-7 border border-slate-200 rounded text-xs px-1 outline-none focus:border-primary-500 text-center" />
                                <select value={it.dose_unit || ''} onChange={e => updateDispenseItem(i, 'dose_unit', e.target.value)}
                                  className="h-7 border border-slate-200 rounded text-xs px-1 bg-white outline-none focus:border-primary-500">
                                  {drugUnits.length === 0
                                    ? <option value="เม็ด">เม็ด</option>
                                    : drugUnits.map((u: string) => <option key={u} value={u}>{u}</option>)
                                  }
                                </select>
                                <span className="text-xs text-slate-400">/ครั้ง</span>
                                <select value={it.frequency || ''} onChange={e => updateDispenseItem(i, 'frequency', e.target.value)}
                                  className="h-7 border border-slate-200 rounded text-xs px-1 outline-none bg-white focus:border-primary-500">
                                  {FREQ.map(o => <option key={o}>{o}</option>)}
                                </select>
                                <select value={it.meal_relation || ''} onChange={e => updateDispenseItem(i, 'meal_relation', e.target.value)}
                                  className="h-7 border border-slate-200 rounded text-xs px-1 bg-white outline-none focus:border-primary-500">
                                  <option value="">ไม่ระบุเวลา</option>
                                  <option>ก่อนอาหาร</option>
                                  <option>หลังอาหาร</option>
                                  <option>พร้อมอาหาร</option>
                                </select>
                                {['เช้า', 'กลางวัน', 'เย็น', 'ก่อนนอน'].map(s => {
                                  const sessions = (it.meal_sessions || '').split(',').filter(Boolean);
                                  const active = sessions.includes(s);
                                  return (
                                    <button key={s} type="button"
                                      onClick={() => {
                                        const next = active ? sessions.filter((x: string) => x !== s) : [...sessions, s];
                                        updateDispenseItem(i, 'meal_sessions', next.join(','));
                                      }}
                                      className={`h-7 px-2 text-xs rounded border font-medium transition-colors ${active ? 'bg-primary-100 text-primary-700 border-primary-400' : 'bg-white text-slate-400 border-slate-200 hover:border-primary-400 hover:text-primary-600'}`}>
                                      {s}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="px-2 py-2 text-right whitespace-nowrap">
                              {unitPrice > 0 ? (
                                <p className={`text-xs font-semibold ${isOverdue ? 'line-through text-slate-400' : 'text-primary-700'}`}>{lineTotal.toFixed(2)}</p>
                              ) : <span className="text-slate-300 text-xs">—</span>}
                            </td>
                            <td className="px-1 py-2 text-center">
                              <button onClick={() => removeDispenseItem(i)} className="text-slate-300 hover:text-red-500 transition-colors">
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {dispenseItems.reduce((s: number, it: any) => s + (Number(it.unit_price) || 0) * Number(it.quantity), 0) > 0 && (
                      <tfoot>
                        <tr className="bg-slate-50 border-t border-slate-200">
                          <td colSpan={4} className="px-3 py-2 text-right text-xs text-slate-500 font-medium">ยอดรวม</td>
                          <td className="px-2 py-2 text-right text-sm font-bold text-primary-700">
                            {dispenseItems.reduce((s: number, it: any) => s + (Number(it.unit_price) || 0) * Number(it.quantity), 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}

            </div>

          </div>

        </Modal>
      )}


      <PatientDrawer
        patientId={patientDrawerId}
        open={!!patientDrawerId}
        onClose={() => setPatientDrawerId(null)}
      />
      <ConfirmDialog {...confirmDialogProps} />

    </MainLayout>
  );
}