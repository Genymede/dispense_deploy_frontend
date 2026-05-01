'use client';
import { useEffect, useState, useCallback } from 'react';
import MainLayout from '@/components/MainLayout';
import { Button, Input, Card, Badge, EmptyState, Spinner } from '@/components/ui';
import { stockApi, type StockTransaction } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ArrowDownToLine, Search, Package, Clock, CheckCircle, ShieldCheck, X, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { thaiToday, fmtDate } from '@/lib/dateUtils';

export default function StockInPage() {
  const [history, setHistory] = useState<StockTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [searchTx, setSearchTx] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 30;
  const [pending, setPending] = useState<StockTransaction[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [approving, setApproving] = useState<number | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await stockApi.getTransactions({ tx_type: 'in', page, limit: perPage });
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

  const todayTxs = history.filter((h) => h.created_at.startsWith(thaiToday()));

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
      actions={
        <a href="https://warehouse.hpk-hms.site/request/withdraw" target="_blank" rel="noopener noreferrer">
          <Button icon={<ExternalLink size={15} />}>เบิกยาจากคลังหลัก</Button>
        </a>
      }
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
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(tx.created_at, true)}</td>
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
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(tx.created_at, true)}</td>
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
    </MainLayout>
  );
}
