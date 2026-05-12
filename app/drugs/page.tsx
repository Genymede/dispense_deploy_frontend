'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import MainLayout from '@/components/MainLayout';
import { Button, Input, Select, Badge, Modal, Card, ConfirmDialog, EmptyState, Spinner, Textarea } from '@/components/ui';
import { FormTabs } from '@/components/CrudModal';
import DetailDrawer, { DrawerSection, DrawerGrid } from '@/components/DetailDrawer';
import { drugApi, stockApi, api, type Drug, type MedTableItem, type StockLot } from '@/lib/api';
import { Search, Filter, Edit2, Trash2, Eye, Package, ArrowDownToLine, RotateCcw, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import SearchSelect from '@/components/SearchSelect';
import toast from 'react-hot-toast';
import { fmtDate } from '@/lib/dateUtils';

const DEFAULT_PACKAGING = ['เม็ด', 'แคปซูล', 'ซอง', 'กล่อง', 'ขวด', 'หลอด', 'มล.', 'กรัม', 'ชิ้น', 'ไวแอล', 'แอมพูล'];

const emptyForm = {
  med_id: 0,
  packaging_type: '',
  is_divisible: false,
  location: '',
  med_showname: '',
  med_showname_eng: '',
};

export default function DrugsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [categories,    setCategories]    = useState<string[]>([]);
  const [packagingTypes, setPackagingTypes] = useState<string[]>(DEFAULT_PACKAGING);
  const [page, setPage] = useState(1);
  const [nearExpiryDays, setNearExpiryDays] = useState(30);
  const perPage = 30;

  const [showModal, setShowModal] = useState(false);
  const [editingSid, setEditingSid] = useState<number | null>(null);
  const [editingDrugName, setEditingDrugName] = useState('');
  const [viewDrug, setViewDrug] = useState<Drug | null>(null);
  const [editingDrug, setEditingDrug] = useState<Drug | null>(null);
  const [viewLots, setViewLots] = useState<StockLot[]>([]);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string,string>>({});
  const [lotsReloadKey, setLotsReloadKey] = useState(0);
  const [writingOff, setWritingOff] = useState(false);
  const [writeOffConfirm, setWriteOffConfirm] = useState<{ lot: StockLot } | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // form state
  const [form, setForm] = useState(emptyForm);
  // med_table picker
  const [showMedPicker, setShowMedPicker] = useState(false);
  const [medSearch, setMedSearch] = useState('');
  const [medTableItems, setMedTableItems] = useState<MedTableItem[]>([]);
  const [selectedMedLabel, setSelectedMedLabel] = useState('');

  const [selectedMed, setSelectedMed] = useState<MedTableItem | null>(null);
  const medSearchTimer = useRef<ReturnType<typeof setTimeout>>();

  const emptyReceiveForm = { med_sid: 0, med_label: '', quantity: '', lot_number: '', expiry_date: '', mfg_date: '', reference_no: '', note: '', cost_price: '', unit_price: '' };
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveForm, setReceiveForm] = useState(emptyReceiveForm);
  const [receiveResetKey, setReceiveResetKey] = useState(0);
  const [receiveSaving, setReceiveSaving] = useState(false);
  const [receiveErrors, setReceiveErrors] = useState<Record<string,string>>({});
  const rf = (k: string, v: any) => setReceiveForm(p => ({ ...p, [k]: v }));
  const clearRE = (k: string) => { if (receiveErrors[k]) setReceiveErrors(p => ({ ...p, [k]: '' })); };

  // ad-hoc stock return
  const emptyReturnForm = { med_sid: 0, med_label: '', quantity: '', ward_from: '', reference_no: '', note: '' };
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnForm, setReturnForm] = useState(emptyReturnForm);
  const [returnResetKey, setReturnResetKey] = useState(0);
  const [returnSaving, setReturnSaving] = useState(false);
  const [returnErrors, setReturnErrors] = useState<Record<string,string>>({});
  const rrf = (k: string, v: any) => setReturnForm(p => ({ ...p, [k]: v }));
  const clearRRE = (k: string) => { if (returnErrors[k]) setReturnErrors(p => ({ ...p, [k]: '' })); };

  const handleReceive = async () => {
    const errs: Record<string,string> = {};
    if (!receiveForm.med_sid) errs.med_sid = 'กรุณาเลือกยา';
    if (!receiveForm.quantity || Number(receiveForm.quantity) <= 0) errs.quantity = 'กรุณาระบุจำนวนให้มากกว่า 0';
    if (Object.keys(errs).length) { setReceiveErrors(errs); return; }
    setReceiveSaving(true);
    try {
      const res = await stockApi.receiveFromMain({
        med_sid: receiveForm.med_sid,
        quantity: Number(receiveForm.quantity),
        lot_number: receiveForm.lot_number || undefined,
        expiry_date: receiveForm.expiry_date || undefined,
        mfg_date: receiveForm.mfg_date || undefined,
        reference_no: receiveForm.reference_no || undefined,
        note: receiveForm.note || undefined,
        cost_price: receiveForm.cost_price ? Number(receiveForm.cost_price) : undefined,
        unit_price: receiveForm.unit_price ? Number(receiveForm.unit_price) : undefined,
      });
      setShowReceiveModal(false);
      setReceiveForm(emptyReceiveForm);
      await loadDrugs();
      if ((res.data as any).auto_created) {
        toast('สร้างรายการยาใหม่อัตโนมัติแล้ว — กรุณากรอกข้อมูลให้ครบ: ชื่อแสดง (ไทย/อังกฤษ), ที่เก็บ, ขั้นต่ำ/สูงสุด, ราคาต้นทุน, ราคาขาย, วันผลิต', {
          icon: '⚠️', duration: 10000,
          style: { background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' },
        });
      } else {
        toast.success('บันทึกการรับยาจากคลังหลักแล้ว');
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setReceiveSaving(false); }
  };

  const handleReturnStock = async () => {
    const errs: Record<string,string> = {};
    if (!returnForm.med_sid) errs.med_sid = 'กรุณาเลือกยา';
    if (!returnForm.quantity || Number(returnForm.quantity) <= 0) errs.quantity = 'กรุณาระบุจำนวนให้มากกว่า 0';
    if (Object.keys(errs).length) { setReturnErrors(errs); return; }
    setReturnSaving(true);
    try {
      await stockApi.returnDrug({
        med_sid: returnForm.med_sid,
        quantity: Number(returnForm.quantity),
        ward_from: returnForm.ward_from || undefined,
        reference_no: returnForm.reference_no || undefined,
        performed_by: user?.id,
        note: returnForm.note || undefined,
      });
      toast.success('บันทึกการคืนยาแล้ว — ยาถูกเพิ่มกลับเข้าคลังในล็อต RET');
      setShowReturnModal(false);
      setReturnForm(emptyReturnForm);
      setReturnResetKey(k => k + 1);
      await loadDrugs();
    } catch (e: any) { toast.error(e.message); }
    finally { setReturnSaving(false); }
  };

  const loadDrugs = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        limit: perPage,
        offset: (page - 1) * perPage,
      };
      if (search) params.search = search;
      if (filterCat) params.category = filterCat;
      if (filterStatus === 'low_stock') params.low_stock = '1';
      else if (filterStatus === 'near_expiry') params.near_expiry = '1';
      else if (filterStatus === 'expired') params.expired = '1';

      const res = await drugApi.getAll(params);
      setDrugs(res.data.data);
      setTotal(res.data.total);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, filterCat, filterStatus, page]);

  useEffect(() => { loadDrugs(); }, [loadDrugs]);

  // auto-open edit modal เมื่อมาจาก alerts (?edit=<med_sid>)
  useEffect(() => {
    const editSid = searchParams.get('edit');
    if (!editSid) return;
    drugApi.getById(Number(editSid))
      .then(r => openEdit(r.data))
      .catch(() => toast.error('ไม่พบรายการยา'));
  }, []);

  // auto-open detail drawer เมื่อมาจาก alerts (?view=<med_sid>)
  useEffect(() => {
    const viewSid = searchParams.get('view');
    if (!viewSid) return;
    drugApi.getById(Number(viewSid))
      .then(r => setViewDrug(r.data))
      .catch(() => toast.error('ไม่พบรายการยา'));
  }, []);

  useEffect(() => {
    drugApi.getCategories().then((r) => setCategories(r.data)).catch(() => { });
    api.get('/settings').then(r => {
      if (r.data.drug_units) try { setPackagingTypes(JSON.parse(r.data.drug_units)); } catch { }
      if (r.data.near_expiry_days) setNearExpiryDays(Number(r.data.near_expiry_days));
    }).catch(() => { });
  }, []);

  useEffect(() => {
    if (!viewDrug) { setViewLots([]); return; }
    drugApi.getLots(viewDrug.med_sid)
      .then(r => setViewLots(r.data))
      .catch(() => setViewLots([]));
  }, [viewDrug?.med_sid, lotsReloadKey]);

  // med_table search debounce
  useEffect(() => {
    clearTimeout(medSearchTimer.current);
    medSearchTimer.current = setTimeout(() => {
      if (showMedPicker) {
        drugApi.getMedTable(medSearch).then((r) => setMedTableItems(r.data)).catch(() => { });
      }
    }, 300);
  }, [medSearch, showMedPicker]);

  const openCreate = () => {
    setForm(emptyForm);
    setSelectedMed(null);
    setSelectedMedLabel('');
    setEditingSid(null);
    setEditingDrug(null);
    setShowModal(true);
  };

  const openEdit = (d: Drug) => {
    setForm({
      med_id: d.med_id,
      packaging_type: d.packaging_type,
      is_divisible: d.is_divisible,
      location: d.location || '',
      med_showname: d.med_showname || '',
      med_showname_eng: d.med_showname_eng || '',
    });
    setEditingSid(d.med_sid);
    setEditingDrugName(d.med_showname || d.med_name);
    setEditingDrug(d);
    setShowModal(true);
  };

  const handleSave = async () => {
    const errs: Record<string,string> = {};
    if (!form.packaging_type) errs.packaging_type = 'กรุณาเลือกรูปแบบบรรจุภัณฑ์';
    if (!editingSid && !form.med_id) errs.med_id = 'กรุณาเลือกยาจากทะเบียนยา';
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    setSaving(true);
    try {
      const payload: any = {
        ...form,
        med_id: Number(form.med_id),
      };
      if (editingSid) {
        await drugApi.update(editingSid, payload);
        toast.success('แก้ไขข้อมูลเรียบร้อย');
      } else {
        await drugApi.create(payload);
        toast.success('เพิ่มยาใหม่เรียบร้อย');
      }
      setShowModal(false);
      loadDrugs();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await drugApi.delete(deleteId);
      toast.success('ลบเรียบร้อย');
      setDeleteId(null);
      loadDrugs();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleWriteOff = async () => {
    if (!writeOffConfirm || !viewDrug) return;
    setWritingOff(true);
    try {
      const payload: { med_sid: number; lot_id?: number } = { med_sid: viewDrug.med_sid, lot_id: writeOffConfirm.lot.lot_id };
      const res = await stockApi.writeOff(payload);
      toast.success(res.data.message);
      setWriteOffConfirm(null);
      setLotsReloadKey(k => k + 1);
      loadDrugs();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setWritingOff(false);
    }
  };

  const f = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));
  const totalPages = Math.ceil(total / perPage);

  return (
    <MainLayout
      title="รายการยาในคลังย่อย"
      subtitle={`ทั้งหมด ${total} รายการ`}
    >
      {/* Filters */}
      <Card className="mb-5">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-48">
            <Input placeholder="ค้นหาชื่อยา, ชื่อสามัญ..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} icon={<Search size={14} />} />
          </div>
          <div className="min-w-44">
            <Select
              placeholder="ทุกหมวดหมู่"
              value={filterCat}
              onChange={(e) => { setFilterCat(e.target.value); setPage(1); }}
              options={categories.map((c) => ({ value: c, label: c }))}
            />
          </div>
          <div className="min-w-40">
            <Select
              placeholder="ทุกสถานะ"
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              options={[
                { value: 'low_stock', label: '⚠ สต็อกต่ำ' },
                { value: 'near_expiry', label: '📅 ใกล้หมดอายุ' },
                { value: 'expired', label: '❌ หมดอายุ' },
              ]}
            />
          </div>
          <Button variant="secondary" icon={<Filter size={14} />}
            onClick={() => { setSearch(''); setFilterCat(''); setFilterStatus(''); setPage(1); }}>
            ล้าง
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center items-center py-16"><Spinner size={28} /></div>
        ) : drugs.length === 0 ? (
          <EmptyState icon={<Package size={40} />} title="ไม่พบรายการยา" description="ลองเปลี่ยนคำค้นหา" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['รูป', 'รหัส', 'ชื่อยา', 'คงเหลือ', 'ขั้นต่ำ', 'หน่วย', 'รูปแบบบรรจุ', 'หมวดหมู่', 'สถานะ', 'จัดการ'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap last:text-right">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {drugs.map((d) => {
                    const isAnyLotExpired = (d.expired_lot_count ?? 0) > 0;
                    const hasValidLots = (d.lot_count ?? 0) > 0;
                    const isNearExp = !!d.nearest_valid_lot_exp &&
                      new Date(d.nearest_valid_lot_exp) <= new Date(Date.now() + nearExpiryDays * 86400_000);
                    const isLow = d.min_quantity != null && d.current_stock < d.min_quantity;
                    
                    let statusV: any = 'success';
                    let statusL = 'ปกติ';
                    
                    if (isAnyLotExpired) {
                      if (hasValidLots) {
                        statusV = 'warning';
                        statusL = 'มีล็อตหมดอายุ';
                      } else {
                        statusV = 'danger';
                        statusL = 'หมดอายุ';
                      }
                    } else if (isLow && isNearExp) {
                      statusV = 'danger';
                      statusL = 'ต่ำ & ใกล้หมดอายุ';
                    } else if (isLow) {
                      statusV = 'warning';
                      statusL = 'สต็อกต่ำ';
                    } else if (isNearExp) {
                      statusV = 'warning';
                      statusL = 'ใกล้หมดอายุ';
                    }

                    return (
                      <tr key={d.med_sid} className="table-row-hover cursor-pointer" onClick={() => setViewDrug(d)}>
                        {/* รูป */}
                        <td className="px-3 py-2.5">
                          {d.image_url
                            ? <img src={d.image_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-100" />
                            : <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300"><Package size={18} /></div>
                          }
                        </td>
                        {/* รหัส */}
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-xs text-slate-500">
                            {d.drug_code || `#${d.med_sid}`}
                          </span>
                        </td>
                        {/* ชื่อยา */}
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-slate-800 leading-tight">{d.med_showname || d.med_name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{d.med_generic_name || d.med_name}</p>
                        </td>
                        {/* คงเหลือ */}
                        <td className="px-4 py-2.5">
                          <span className={`font-semibold tabular-nums ${isLow || isAnyLotExpired ? 'text-red-600' : 'text-slate-800'}`}>
                            {d.current_stock.toLocaleString()}
                          </span>
                          {d.lot_count != null && d.lot_count > 0 && (
                            <span className="ml-1.5 text-[10px] font-semibold bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full">
                              {d.lot_count} lot
                            </span>
                          )}
                        </td>
                        {/* ขั้นต่ำ */}
                        <td className="px-4 py-2.5 text-xs tabular-nums text-slate-500">
                          {d.min_quantity ?? '-'}
                        </td>
                        {/* หน่วย */}
                        <td className="px-4 py-2.5 text-xs text-slate-600">{d.unit || '-'}</td>
                        {/* รูปแบบบรรจุ */}
                        <td className="px-4 py-2.5 text-xs text-slate-600">{d.packaging_type || '-'}</td>
                        {/* หมวดหมู่ */}
                        <td className="px-4 py-2.5 text-xs text-slate-600">{d.category || '-'}</td>
                        {/* สถานะ */}
                        <td className="px-4 py-2.5"><Badge variant={statusV} dot>{statusL}</Badge></td>
                        {/* จัดการ */}
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                            <button onClick={() => { rrf('med_sid', d.med_sid); rrf('med_label', d.med_showname || d.med_name || ''); setShowReturnModal(true); }}
                              className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors" title="คืนยา">
                              <RotateCcw size={15} />
                            </button>
                            <button onClick={() => setViewDrug(d)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary-600 transition-colors"><Eye size={15} /></button>
                            <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-amber-600 transition-colors"><Edit2 size={15} /></button>
                            <button onClick={() => setDeleteId(d.med_sid)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <p className="text-xs text-slate-500">หน้า {page}/{totalPages} (ทั้งหมด {total})</p>
                <div className="flex gap-1">
                  <Button variant="secondary" size="xs" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>◀</Button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 3, totalPages - 6));
                    return start + i;
                  }).map((p) => (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-primary-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                      {p}
                    </button>
                  ))}
                  <Button variant="secondary" size="xs" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>▶</Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingSid ? `แก้ไขข้อมูลยา — ${editingDrugName}` : 'เพิ่มยาในคลัง'} size="lg"
        footer={<><Button variant="secondary" onClick={() => setShowModal(false)}>ยกเลิก</Button><Button onClick={handleSave} loading={saving}>บันทึก</Button></>}
      >
        <div className="flex flex-col gap-4">
          {/* Drug picker — create only */}
          {!editingSid && (
            <div>
              <SearchSelect type="drug" label="ยา (ทะเบียนยา)" required
                initialDisplay={selectedMedLabel} resetKey={showModal ? 'open' : 'closed'}
                onSelect={d => {
                  if (d) {
                    setSelectedMed(d); setSelectedMedLabel(d.med_name);
                    f('med_id', d.med_id);
                    if (formErrors.med_id) setFormErrors(p => ({ ...p, med_id: '' }));
                    if (!form.med_showname) f('med_showname', d.med_name);
                  } else { setSelectedMed(null); setSelectedMedLabel(''); f('med_id', 0); }
                }} />
              {formErrors.med_id && <p className="mt-1 text-xs text-red-500">{formErrors.med_id}</p>}
            </div>
          )}

          {/* Drug info card */}
          {(selectedMed || editingDrug) && (() => {
            const d = selectedMed ?? editingDrug!;
            const rows: { label: string; value: string }[] = [
              { label: 'หมวดหมู่',  value: (d as any).med_medical_category ?? (d as any).category ?? '—' },
              { label: 'รูปแบบยา',  value: (d as any).med_dosage_form ?? '—' },
              { label: 'ระดับ',     value: (d as any).med_severity ?? '—' },
              { label: 'ชื่อสามัญ', value: (d as any).med_generic_name ?? '—' },
              { label: 'ชื่อการค้า',value: (d as any).med_marketing_name ?? '—' },
              { label: 'ชื่อไทย',   value: (d as any).med_thai_name ?? '—' },
            ].filter(r => r.value && r.value !== '—');
            if (!rows.length) return null;
            return (
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-2">
                {rows.map(r => (
                  <div key={r.label} className="min-w-0">
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">{r.label}</p>
                    <p className="text-xs font-medium text-slate-700 truncate" title={r.value}>{r.value}</p>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Form fields — 3 column grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="col-span-2">
              <Input label="ชื่อแสดง (ไทย)" value={form.med_showname} onChange={(e) => f('med_showname', e.target.value)} />
            </div>
            <Input label="ชื่อแสดง (อังกฤษ)" value={form.med_showname_eng} onChange={(e) => f('med_showname_eng', e.target.value)} />
            <Select label="รูปแบบบรรจุ" required value={form.packaging_type}
              onChange={(e) => { f('packaging_type', e.target.value); if (formErrors.packaging_type) setFormErrors(p => ({ ...p, packaging_type: '' })); }}
              options={packagingTypes.map((p) => ({ value: p, label: p }))} placeholder="เลือกรูปแบบ"
              error={formErrors.packaging_type} />
            <Input label="ตำแหน่งที่เก็บ" placeholder="เช่น A-01" value={form.location} onChange={(e) => f('location', e.target.value)} />
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div className="relative">
                  <input type="checkbox" id="div" checked={form.is_divisible} onChange={(e) => f('is_divisible', e.target.checked)} className="sr-only peer" />
                  <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-primary-500 transition-colors" />
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">แบ่งได้</p>
                  <p className="text-[10px] text-slate-400">Divisible</p>
                </div>
              </label>
            </div>
          </div>
        </div>
      </Modal>



      {/* View Drawer */}
      <DetailDrawer
        open={!!viewDrug} onClose={() => setViewDrug(null)}
        title={viewDrug ? (viewDrug.med_showname || viewDrug.med_name) : ''}
        subtitle={viewDrug?.med_generic_name ?? ''}
      >
        {viewDrug && (
          <>
            {/* 1. รายละเอียด Lot — สำคัญที่สุด */}
            <DrawerSection title={`รายละเอียด Lot (${viewLots.filter(l => l.quantity > 0).length} lot)`}>
              {viewLots.filter(l => l.quantity > 0).length === 0 ? (
                <p className="text-xs text-slate-400">ยังไม่มี lot ในคลัง</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-100 -mx-1">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        {['Lot Number', 'จำนวน', 'วันหมดอายุ', 'ราคาทุน/หน่วย', 'ราคาขาย/หน่วย', ''].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-slate-400 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {viewLots.filter(l => l.quantity > 0).map(lot => {
                        const isExpired = lot.exp_date ? new Date(lot.exp_date) < new Date() : false;
                        const isNearExpiry = lot.exp_date ? new Date(lot.exp_date) <= new Date(Date.now() + nearExpiryDays * 86400_000) : false;
                        return (
                          <tr key={lot.lot_id} className={isExpired ? 'bg-red-50' : isNearExpiry ? 'bg-amber-50' : ''}>
                            <td className="px-3 py-2 font-mono text-slate-700">{lot.lot_number || <span className="text-slate-300">—</span>}</td>
                            <td className="px-3 py-2 font-semibold text-slate-800">{lot.quantity.toLocaleString()}</td>
                            <td className={`px-3 py-2 ${isExpired ? 'text-red-600 font-semibold' : isNearExpiry ? 'text-amber-600' : 'text-slate-500'}`}>
                              {fmtDate(lot.exp_date)}
                            </td>
                            <td className="px-3 py-2 text-slate-600 tabular-nums">
                              {lot.cost_price != null ? `฿${Number(lot.cost_price).toFixed(2)}` : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-3 py-2 text-slate-600 tabular-nums">
                              {lot.unit_price != null ? `฿${Number(lot.unit_price).toFixed(2)}` : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-3 py-2">
                              {isExpired && lot.quantity > 0 && (
                                <button
                                  onClick={() => setWriteOffConfirm({ lot })}
                                  className="p-1 rounded hover:bg-red-100 text-slate-300 hover:text-red-600 transition-colors"
                                  title="ตัดออก"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-100">
                      <tr>
                        <td className="px-3 py-2 font-semibold text-slate-500">รวม</td>
                        <td className="px-3 py-2 font-bold text-slate-800">{viewLots.filter(l => l.quantity > 0).reduce((s, l) => s + l.quantity, 0).toLocaleString()}</td>
                        <td /><td /><td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </DrawerSection>

            {/* 2. สต็อก & อายุ */}
            <DrawerSection title="สต็อก & อายุ">
              <DrawerGrid items={[
                {
                  label: 'สต็อกปัจจุบัน',
                  value: <span className={`font-bold text-base ${viewDrug.current_stock < (viewDrug.min_quantity ?? Infinity) ? 'text-red-600' : 'text-green-600'}`}>
                    {viewDrug.current_stock.toLocaleString()} {viewDrug.unit}
                  </span>
                },
                {
                  label: 'สถานะ', value: (() => {
                    const anyExpired = (viewDrug.expired_lot_count ?? 0) > 0;
                    const validLots = (viewDrug.lot_count ?? 0) > 0;
                    const nearExp = !!viewDrug.nearest_valid_lot_exp &&
                      new Date(viewDrug.nearest_valid_lot_exp) <= new Date(Date.now() + nearExpiryDays * 86400_000);
                    const low = viewDrug.min_quantity != null && viewDrug.current_stock < viewDrug.min_quantity;
                    if (anyExpired && !validLots) return <Badge variant="danger" dot>หมดอายุ</Badge>;
                    if (anyExpired) return <Badge variant="warning" dot>มีล็อตหมดอายุ</Badge>;
                    if (low && nearExp) return <Badge variant="danger" dot>ต่ำ & ใกล้หมดอายุ</Badge>;
                    if (low) return <Badge variant="warning" dot>สต็อกต่ำ</Badge>;
                    if (nearExp) return <Badge variant="warning" dot>ใกล้หมดอายุ</Badge>;
                    if (viewDrug.med_out_of_stock) return <Badge variant="warning" dot>หมดสต็อก</Badge>;
                    return <Badge variant="success" dot>ปกติ</Badge>;
                  })()
                },
                { label: 'วันผลิต', value: fmtDate(viewDrug.mfg_date) },
                { label: 'ที่เก็บ', value: viewDrug.location || '—' },
              ]} />
            </DrawerSection>

            {/* 3. ข้อมูลยา — identity & clinical */}
            <DrawerSection title="ข้อมูลยา">
              <DrawerGrid items={[
                { label: 'ชื่อแสดง (ไทย)', value: viewDrug.med_showname || '—', span: true },
                { label: 'ชื่อแสดง (อังกฤษ)', value: viewDrug.med_showname_eng || '—', span: true },
                { label: 'ชื่อสามัญ', value: viewDrug.med_generic_name || '—', span: true },
                { label: 'ชื่อทะเบียน', value: viewDrug.med_name, span: true },
                { label: 'ชื่อไทย (med_table)', value: viewDrug.med_thai_name || '—', span: true },
                { label: 'ชื่อการค้า', value: viewDrug.med_marketing_name || '—', span: true },
                { label: 'หมวดหมู่', value: viewDrug.category || '—' },
                { label: 'รูปแบบยา', value: viewDrug.med_dosage_form || '—' },
                { label: 'ระดับ', value: viewDrug.med_severity || '—' },
                { label: 'รูปแบบบรรจุ', value: viewDrug.packaging_type },
                { label: 'หน่วย', value: viewDrug.unit },
                { label: 'แบ่งได้', value: viewDrug.is_divisible ? 'ใช่' : 'ไม่ใช่' },
              ]} />
            </DrawerSection>

            {/* 4. ราคา */}
            <DrawerSection title="ราคา">
              <DrawerGrid items={[
                { label: 'ราคาต้นทุน', value: viewDrug.cost_price != null ? `฿${Number(viewDrug.cost_price).toFixed(2)}` : '—' },
                { label: 'ราคาขาย', value: viewDrug.unit_price != null ? `฿${Number(viewDrug.unit_price).toFixed(2)}` : '—' },
              ]} />
            </DrawerSection>

            {/* 5. บันทึก */}
            <DrawerSection title="บันทึก">
              <DrawerGrid items={[
                { label: 'เพิ่มเข้าคลัง', value: fmtDate(viewDrug.created_at, true) },
                { label: 'อัปเดตล่าสุด', value: fmtDate(viewDrug.updated_at, true) },
              ]} />
            </DrawerSection>

            <DrawerSection title="">
              <Button variant="secondary" onClick={() => { setViewDrug(null); openEdit(viewDrug); }}>แก้ไข</Button>
            </DrawerSection>
          </>
        )}
      </DetailDrawer>

      {/* Write-off Confirm Dialog — portal so it stacks above DetailDrawer */}
      {mounted && writeOffConfirm && viewDrug && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-3">
              <Trash2 size={22} className="text-red-600" />
              <h3 className="font-bold text-base text-slate-800">ยืนยันการตัดออก</h3>
            </div>
            <p className="text-sm text-slate-600 mb-1">
              ตัดล็อต <span className="font-mono font-semibold">{writeOffConfirm.lot.lot_number || '—'}</span> ของ
            </p>
            <p className="font-semibold text-slate-800 mb-1">{viewDrug.med_showname || viewDrug.med_name}</p>
            <p className="text-sm text-slate-500 mb-5">
              จำนวน <span className="font-semibold text-red-600">{writeOffConfirm.lot.quantity.toLocaleString()} {viewDrug.unit}</span> ออกจากคลัง
              <br /><span className="text-xs">การกระทำนี้ไม่สามารถย้อนกลับได้</span>
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setWriteOffConfirm(null)} disabled={writingOff}
                className="px-4 py-2 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                ยกเลิก
              </button>
              <button onClick={handleWriteOff} disabled={writingOff}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
                {writingOff ? 'กำลังตัดออก...' : 'ยืนยันตัดออก'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <ConfirmDialog open={!!deleteId} title="ลบรายการยา"
        message="คุณแน่ใจหรือไม่ที่จะลบรายการยานี้ออกจากคลัง?"
        confirmLabel="ลบ" onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />

      <Modal open={showReceiveModal} onClose={() => { setShowReceiveModal(false); setReceiveErrors({}); }}
        title="รับยาจากคลังหลัก" size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowReceiveModal(false)}>ยกเลิก</Button>
            <Button onClick={handleReceive} loading={receiveSaving}>บันทึกการรับยา</Button>
          </>
        }
      >
        <FormTabs tabs={[
          {
            label: 'เลือกยา',
            content: (
              <div>
                <SearchSelect type="subwarehouse" label="ยาในคลัง" required
                  initialDisplay={receiveForm.med_label} resetKey={receiveResetKey}
                  onSelect={d => { rf('med_sid', d?.med_sid ?? 0); rf('med_label', d ? (d.med_showname || d.med_name) : ''); clearRE('med_sid'); }} />
                {receiveErrors.med_sid && <p className="mt-1 text-xs text-red-500">{receiveErrors.med_sid}</p>}
              </div>
            ),
          },
          {
            label: 'รายละเอียด Lot',
            content: (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="จำนวนที่รับ" type="number" min="1" required
                  value={receiveForm.quantity} onChange={e => { rf('quantity', e.target.value); clearRE('quantity'); }}
                  error={receiveErrors.quantity} />
                <Input label="เลข Lot" value={receiveForm.lot_number} onChange={e => rf('lot_number', e.target.value)} />
                <Input label="วันหมดอายุ" type="date" value={receiveForm.expiry_date} onChange={e => rf('expiry_date', e.target.value)} />
                <Input label="วันผลิต" type="date" value={receiveForm.mfg_date} onChange={e => rf('mfg_date', e.target.value)} />
                <Input label="ราคาทุน/หน่วย (บาท)" type="number" min="0" step="0.01" placeholder="0.00"
                  value={receiveForm.cost_price} onChange={e => rf('cost_price', e.target.value)} />
                <Input label="ราคาขาย/หน่วย (บาท)" type="number" min="0" step="0.01" placeholder="0.00"
                  value={receiveForm.unit_price} onChange={e => rf('unit_price', e.target.value)} />
              </div>
            ),
          },
          {
            label: 'อ้างอิง & หมายเหตุ',
            content: (
              <div className="flex flex-col gap-4">
                <Input label="เลขอ้างอิงใบเบิก" placeholder="เช่น REQ-2025-001"
                  value={receiveForm.reference_no} onChange={e => rf('reference_no', e.target.value)} />
                <Textarea label="หมายเหตุ" rows={2} value={receiveForm.note} onChange={e => rf('note', e.target.value)} />
              </div>
            ),
          },
        ]} />
      </Modal>

      {/* ── RETURN STOCK MODAL ── */}
      <Modal open={showReturnModal} onClose={() => { if (!returnSaving) { setShowReturnModal(false); setReturnErrors({}); } }}
        title="คืนยา (ad-hoc)" size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowReturnModal(false)} disabled={returnSaving}>ยกเลิก</Button>
            <Button variant="warning" onClick={handleReturnStock} loading={returnSaving}>
              <RotateCcw size={14} className="mr-1" /> ยืนยันคืนยา
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            <span>ยาที่คืนจะสร้างล็อต <strong>RET-…</strong> ไม่มีวันหมดอายุ และถูกเลือกใช้ท้ายสุดตาม FEFO</span>
          </div>
          <FormTabs tabs={[
            {
              label: 'เลือกยา',
              content: (
                <div>
                  <SearchSelect type="subwarehouse" label="ยาในคลัง" required
                    initialDisplay={returnForm.med_label} resetKey={returnResetKey}
                    onSelect={d => { rrf('med_sid', d?.med_sid ?? 0); rrf('med_label', d ? (d.med_showname || d.med_name) : ''); clearRRE('med_sid'); }} />
                  {returnErrors.med_sid && <p className="mt-1 text-xs text-red-500">{returnErrors.med_sid}</p>}
                </div>
              ),
            },
            {
              label: 'รายละเอียด',
              content: (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="จำนวนที่คืน" type="number" min="1" required
                    value={returnForm.quantity} onChange={e => { rrf('quantity', e.target.value); clearRRE('quantity'); }}
                    error={returnErrors.quantity} />
                  <Input label="แผนก/หอผู้ป่วย" placeholder="เช่น IPD-1"
                    value={returnForm.ward_from} onChange={e => rrf('ward_from', e.target.value)} />
                  <Input label="เลขอ้างอิง" placeholder="เช่น RX-2025-001"
                    value={returnForm.reference_no} onChange={e => rrf('reference_no', e.target.value)} />
                  <div className="sm:col-span-2">
                    <Textarea label="หมายเหตุ / เหตุผลการคืน" rows={2}
                      value={returnForm.note} onChange={e => rrf('note', e.target.value)} />
                  </div>
                </div>
              ),
            },
          ]} />
        </div>
      </Modal>
    </MainLayout>
  );
}
