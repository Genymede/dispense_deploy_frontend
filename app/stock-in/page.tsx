'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import MainLayout from '@/components/MainLayout';
import { Button, Input, Card, Badge, Modal, EmptyState, Spinner, Textarea } from '@/components/ui';
import { stockApi, drugApi, type Drug, type StockTransaction } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import UserSelect from '@/components/UserSelect';
import SearchSelect from '@/components/SearchSelect';
import { ArrowDownToLine, Search, Plus, Package, Clock, CheckCircle, ShieldCheck, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { thaiToday, fmtDate } from '@/lib/dateUtils';

const emptyForm = {
  med_sid: 0,
  quantity: '',
  lot_number: '',
  expiry_date: '',
  reference_no: '',
  note: '',
};

export default function StockInPage() {
  const [history, setHistory] = useState<StockTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedDrug, setSelectedDrug] = useState<Drug | null>(null);
  const [drugList, setDrugList] = useState<Drug[]>([]);
  const [drugSearch, setDrugSearch] = useState('');
  const [showDrugPicker, setShowDrugPicker] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [searchTx, setSearchTx] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 30;
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const [pending, setPending] = useState<StockTransaction[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [approving, setApproving] = useState<number | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await stockApi.getTransactions({
        tx_type: 'in', page, limit: perPage,
      });
      setHistory(res.data.data);
      setTotal(res.data.total);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const res = await stockApi.getPendingIn();
      setPending(res.data);
    } catch {} finally { setPendingLoading(false); }
  }, []);

  useEffect(() => { loadHistory(); loadPending(); }, [loadHistory, loadPending]);

  const handleApprove = async (tx_id: number) => {
    setApproving(tx_id);
    try {
      await stockApi.approve(tx_id, user?.email);
      toast.success('อนุมัติแล้ว สต็อกถูกอัปเดต');
      loadPending();
      loadHistory();
    } catch (err: any) {
      toast.error(err.message);
    } finally { setApproving(null); }
  };

  const handleReject = async (tx_id: number) => {
    setApproving(tx_id);
    try {
      await stockApi.reject(tx_id);
      toast.success('ปฏิเสธคำขอแล้ว');
      loadPending();
    } catch (err: any) {
      toast.error(err.message);
    } finally { setApproving(null); }
  };

  // drug picker search
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      if (!showDrugPicker) return;
      setPickerLoading(true);
      try {
        const res = await drugApi.getAll({ search: drugSearch, limit: 50 });
        setDrugList(res.data.data);
      } catch {} finally {
        setPickerLoading(false);
      }
    }, 300);
  }, [drugSearch, showDrugPicker]);

  const openPicker = async () => {
    setShowDrugPicker(true);
    setPickerLoading(true);
    try {
      const res = await drugApi.getAll({ limit: 50 });
      setDrugList(res.data.data);
    } catch {} finally {
      setPickerLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.med_sid) { toast.error('กรุณาเลือกยา'); return; }
    if (!form.quantity || Number(form.quantity) <= 0) { toast.error('กรุณาระบุจำนวน > 0'); return; }
    if (Number(form.quantity) > 99999) { toast.error('จำนวนสูงสุดคือ 99,999'); return; }
    if (form.expiry_date && new Date(form.expiry_date) <= new Date()) {
      toast.error('วันหมดอายุต้องเป็นวันในอนาคต'); return;
    }
    setSaving(true);
    try {
      const tx = await stockApi.stockIn({
        med_sid: form.med_sid,
        quantity: Number(form.quantity),
        lot_number: form.lot_number || undefined,
        expiry_date: form.expiry_date || undefined,
        reference_no: form.reference_no || undefined,
        note: form.note || undefined,
      });
      toast.success('บันทึกการรับยาเรียบร้อย');
      setHistory((h) => [tx.data, ...h]);
      setTotal((t) => t + 1);
      setShowModal(false);
      setForm(emptyForm);
      setSelectedDrug(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const todayTxs = history.filter((h) =>
    h.created_at.startsWith(thaiToday())
  );

  const f = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const filteredHistory = searchTx
    ? history.filter(
        (h) =>
          (h.med_showname || h.med_name).includes(searchTx) ||
          (h.reference_no || '').includes(searchTx)
      )
    : history;

  return (
    <MainLayout
      title="รับยาเข้าคลัง"
      subtitle="บันทึกการรับยาจากคลังกลาง"
      actions={<Button icon={<Plus size={15} />} onClick={() => setShowModal(true)}>บันทึกรับยา</Button>}
    >
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: 'รับยาวันนี้', value: todayTxs.length, icon: <ArrowDownToLine size={18} />, color: 'text-primary-600 bg-primary-50' },
          { label: 'หน่วยรับทั้งหมดวันนี้', value: todayTxs.reduce((s, h) => s + h.quantity, 0).toLocaleString(), icon: <Package size={18} />, color: 'text-green-600 bg-green-50' },
          { label: 'ประวัติทั้งหมด', value: total.toLocaleString(), icon: <Clock size={18} />, color: 'text-slate-600 bg-slate-100' },
        ].map(({ label, value, icon, color }) => (
          <Card key={label} className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
            <div>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-2xl font-bold text-slate-800">{value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Pending Requests */}
      <Card className="overflow-hidden p-0 mb-5">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-700">คำขอรออนุมัติ</h2>
            {pending.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">{pending.length}</span>
            )}
          </div>
        </div>
        {pendingLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : pending.length === 0 ? (
          <EmptyState icon={<CheckCircle size={28} />} title="ไม่มีคำขอรออนุมัติ" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-amber-50 border-b border-amber-100">
              <tr>
                {['เวลาขอ', 'ชื่อยา', 'จำนวน', 'Lot', 'วันหมดอายุ', 'เลขอ้างอิง', 'ผู้ขอ', 'หมายเหตุ', 'จัดการ'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-amber-700 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pending.map(tx => (
                <tr key={tx.tx_id} className="table-row-hover">
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {fmtDate(tx.created_at, true)}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{tx.med_showname || tx.med_name}</td>
                  <td className="px-4 py-3"><Badge variant="info">+{tx.quantity.toLocaleString()}</Badge></td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{tx.lot_number || '-'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(tx.expiry_date)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{tx.reference_no || '-'}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{tx.performed_by_name || '-'}</td>
                  <td className="px-4 py-3 text-xs text-slate-400 max-w-32 truncate">{tx.note || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        disabled={approving === tx.tx_id}
                        onClick={() => handleApprove(tx.tx_id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                        title="อนุมัติ">
                        <ShieldCheck size={13} />อนุมัติ
                      </button>
                      <button
                        disabled={approving === tx.tx_id}
                        onClick={() => handleReject(tx.tx_id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                        title="ปฏิเสธ">
                        <X size={13} />ปฏิเสธ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* History */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">ประวัติการรับยา</h2>
          <div className="w-64">
            <Input placeholder="ค้นหา..." value={searchTx} onChange={(e) => setSearchTx(e.target.value)} icon={<Search size={13} />} />
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filteredHistory.length === 0 ? (
          <EmptyState icon={<ArrowDownToLine size={36} />} title="ยังไม่มีประวัติการรับยา" />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['เวลา', 'ชื่อยา', 'จำนวนรับ', 'สต็อกก่อน→หลัง', 'Lot', 'เลขอ้างอิง', 'สถานะ', 'ผู้บันทึก', 'หมายเหตุ'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredHistory.map((tx) => (
                  <tr key={tx.tx_id} className="table-row-hover">
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {fmtDate(tx.created_at, true)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{tx.med_showname || tx.med_name}</td>
                    <td className="px-4 py-3"><Badge variant="success">+{tx.quantity.toLocaleString()}</Badge></td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500">
                      {tx.balance_before} <span className="text-slate-300">→</span> <span className="font-semibold text-primary-700">{tx.balance_after}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{tx.lot_number || '-'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{tx.reference_no || '-'}</td>
                    <td className="px-4 py-3">
                      {tx.approval_status === 'approved'
                        ? <Badge variant="success">อนุมัติแล้ว</Badge>
                        : tx.approval_status === 'rejected'
                        ? <Badge variant="danger">ปฏิเสธ</Badge>
                        : <Badge variant="warning">รออนุมัติ</Badge>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{tx.performed_by_name || '-'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 max-w-32 truncate">{tx.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {Math.ceil(total / perPage) > 1 && (
              <div className="flex justify-between items-center px-4 py-3 border-t border-slate-100">
                <p className="text-xs text-slate-500">หน้า {page}/{Math.ceil(total / perPage)}</p>
                <div className="flex gap-1">
                  <Button variant="secondary" size="xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>◀</Button>
                  <Button variant="secondary" size="xs" disabled={page >= Math.ceil(total / perPage)} onClick={() => setPage(p => p + 1)}>▶</Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Stock In Modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setSelectedDrug(null); setForm(emptyForm); }}
        title="บันทึกรับยาเข้าคลัง" size="lg"
        footer={<><Button variant="secondary" onClick={() => setShowModal(false)}>ยกเลิก</Button>
          <Button icon={<CheckCircle size={15} />} onClick={handleSubmit} loading={saving}>บันทึก</Button></>}
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-700">เลือกยา <span className="text-red-500">*</span></label>
            <button type="button" onClick={openPicker}
              className="mt-1 w-full h-9 px-3 border border-slate-200 rounded-lg text-sm text-left flex items-center gap-2 hover:border-primary-400 transition-colors">
              {selectedDrug
                ? <span className="text-slate-800">{selectedDrug.med_showname || selectedDrug.med_name}</span>
                : <span className="text-slate-400 flex items-center gap-2"><Search size={13} />คลิกเพื่อเลือกยา</span>}
            </button>
          </div>
          {selectedDrug && (
            <div className="p-3 bg-primary-50 rounded-xl border border-primary-100 text-sm grid grid-cols-3 gap-2">
              <div><p className="text-xs text-slate-500">สต็อกปัจจุบัน</p><p className="font-semibold">{selectedDrug.current_stock} {selectedDrug.unit}</p></div>
              <div><p className="text-xs text-slate-500">สต็อกสูงสุด</p><p className="font-semibold">{selectedDrug.max_quantity ?? '-'}</p></div>
              <div><p className="text-xs text-slate-500">ที่เก็บ</p><p className="font-semibold">{selectedDrug.location || '-'}</p></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input label="จำนวนที่รับ" type="number" required placeholder="0" value={form.quantity}
              onChange={(e) => f('quantity', e.target.value)} suffix={selectedDrug?.unit || 'หน่วย'} />
            <Input label="เลข Lot" placeholder="LOT240101" value={form.lot_number} onChange={(e) => f('lot_number', e.target.value)} />
            <Input label="วันหมดอายุ" type="date" value={form.expiry_date} onChange={(e) => f('expiry_date', e.target.value)} />
            <Input label="เลขอ้างอิง / ใบสั่งซื้อ" placeholder="PO-2024-001" value={form.reference_no} onChange={(e) => f('reference_no', e.target.value)} />
          </div>
          <Textarea label="หมายเหตุ" placeholder="หมายเหตุเพิ่มเติม..." value={form.note} onChange={(e) => f('note', e.target.value)} />
        </div>
      </Modal>

      {/* Drug Picker */}
      <Modal open={showDrugPicker} onClose={() => setShowDrugPicker(false)} title="เลือกยา" size="md">
        <Input placeholder="ค้นหา..." value={drugSearch} onChange={(e) => setDrugSearch(e.target.value)} icon={<Search size={13} />} className="mb-3" />
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {pickerLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : drugList.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-8">ไม่พบรายการ</p>
          ) : drugList.map((d) => (
            <button key={d.med_sid}
              onClick={() => { setSelectedDrug(d); f('med_sid', d.med_sid); setShowDrugPicker(false); }}
              className="w-full text-left p-3 rounded-lg border border-slate-100 hover:border-primary-300 hover:bg-primary-50 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800 text-sm">{d.med_showname || d.med_name}</p>
                  <p className="text-xs text-slate-500">{d.med_generic_name} · {d.packaging_type}</p>
                </div>
                <Badge variant={d.current_stock === 0 ? 'danger' : d.min_quantity != null && d.current_stock < d.min_quantity ? 'warning' : 'success'}>
                  {d.current_stock} {d.unit}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </MainLayout>
  );
}
