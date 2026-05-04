'use client';
import { useEffect, useState, useCallback } from 'react';
import MainLayout from '@/components/MainLayout';
import { Input, Select, Card, Badge, Button, EmptyState, Spinner } from '@/components/ui';
import DetailDrawer, { DrawerSection, DrawerGrid } from '@/components/DetailDrawer';
import { stockApi, type StockTransaction } from '@/lib/api';
import ReportPrintTemplate from '@/components/ReportPrintTemplate';
import { createPortal } from 'react-dom';
import { Activity, Search, ArrowUpCircle, ArrowDownCircle, RotateCcw, AlertTriangle, Settings, Download } from 'lucide-react';
import { thaiToday, thaiDaysAgo, fmtDate as safeDate } from '@/lib/dateUtils';
import toast from 'react-hot-toast';

const TX_CONFIG: Record<string, { label: string; icon: React.ReactNode; variant: 'success' | 'danger' | 'info' | 'warning' | 'gray' }> = {
  in:      { label: 'รับเข้า',   icon: <ArrowDownCircle size={13} />, variant: 'success' },
  out:     { label: 'จ่ายออก',  icon: <ArrowUpCircle size={13} />,   variant: 'info' },
  adjust:  { label: 'ปรับสต็อก', icon: <Settings size={13} />,        variant: 'warning' },
  return:  { label: 'คืนยา',    icon: <RotateCcw size={13} />,        variant: 'gray' },
  expired: { label: 'หมดอายุ',  icon: <AlertTriangle size={13} />,    variant: 'danger' },
};

export default function TransactionsPage() {
  const [txs, setTxs] = useState<StockTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [dateFrom, setDateFrom] = useState(thaiDaysAgo(7));
  const [dateTo, setDateTo] = useState(thaiToday());
  const [page, setPage] = useState(1);
  const perPage = 40;
  const [selectedTx, setSelectedTx] = useState<StockTransaction | null>(null);
  const [exporting, setExporting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printData, setPrintData] = useState<StockTransaction[]>([]);

  const TX_LABEL: Record<string, string> = {
    in: 'รับเข้า', out: 'จ่ายออก', adjust: 'ปรับสต็อก', return: 'คืนยา', expired: 'หมดอายุ',
  };

  async function fetchAll(): Promise<StockTransaction[]> {
    const res = await stockApi.getTransactions({
      tx_type: filterType || undefined,
      date_from: dateFrom, date_to: dateTo,
      page: 1, limit: 9999,
    });
    return res.data.data;
  }

  async function handleExportCSV() {
    setExporting(true);
    try {
      const rows = await fetchAll();
      const header = ['วันเวลา','ประเภท','ชื่อยา','ชื่อสามัญ','จำนวน','สต็อกก่อน','สต็อกหลัง','เลขอ้างอิง','ผู้ดำเนินการ','หมายเหตุ'];
      const data = rows.map(t => [
        safeDate(t.created_at, true),
        TX_LABEL[t.tx_type] ?? t.tx_type,
        t.med_showname || t.med_name,
        t.med_generic_name || '',
        String(t.quantity),
        String(t.balance_before),
        String(t.balance_after),
        t.reference_no || t.prescription_no || t.ward_from || '',
        t.performed_by_name || '',
        t.note || '',
      ]);
      const csvContent = [header, ...data].map(row =>
        row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
      ).join('\r\n');
      const bom = '\uFEFF';
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `ประวัติเคลื่อนไหวยา_${dateFrom}_${dateTo}.csv`;
      a.click(); URL.revokeObjectURL(url);
    } catch (err: any) { toast.error('ออก CSV ไม่สำเร็จ: ' + err.message); }
    finally { setExporting(false); }
  }

  async function handleExportPDF() {
    setExporting(true);
    try {
      const rows = await fetchAll();
      setPrintData(rows);
      setIsPrinting(true);
      setTimeout(() => {
        window.print();
        setIsPrinting(false);
      }, 500);
    } catch (err: any) { toast.error('โหลดข้อมูล PDF ไม่สำเร็จ: ' + err.message); }
    finally { setExporting(false); }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await stockApi.getTransactions({
        tx_type: filterType || undefined,
        date_from: dateFrom, date_to: dateTo,
        page, limit: perPage,
      });
      setTxs(res.data.data);
      setTotal(res.data.total);
    } catch (err: any) {
      toast.error(err.message);
    } finally { setLoading(false); }
  }, [filterType, dateFrom, dateTo, page]);

  useEffect(() => { load(); }, [load]);

  const filtered = search
    ? txs.filter(t =>
        (t.med_showname || t.med_name).includes(search) ||
        (t.reference_no || '').includes(search) ||
        (t.prescription_no || '').includes(search)
      )
    : txs;

  if (isPrinting) {
    const content = (
      <div className="print-only print-unbound bg-white text-black min-h-screen">
        <ReportPrintTemplate
          title="รายงานประวัติการเคลื่อนไหวยา"
          dateRange={`วันที่ ${dateFrom} ถึง ${dateTo}`}
          columns={[
            { label: 'วันเวลา', key: 'created_at', render: r => safeDate(r.created_at, true) },
            { label: 'ประเภท', key: 'tx_type', render: r => TX_LABEL[r.tx_type] ?? r.tx_type },
            { label: 'ชื่อยา', key: 'drug_name', render: r => r.med_showname || r.med_name },
            { label: 'จำนวน', key: 'quantity', render: r => (r.tx_type === 'in' || r.tx_type === 'return' ? '+' : '') + r.quantity.toLocaleString() },
            { label: 'ก่อน→หลัง', key: 'balance', render: r => `${r.balance_before.toLocaleString()} → ${r.balance_after.toLocaleString()}` },
            { label: 'เลขอ้างอิง', key: 'ref', render: r => r.reference_no || r.prescription_no || r.ward_from || '-' },
            { label: 'ผู้ดำเนินการ', key: 'performed_by_name', render: r => r.performed_by_name || '-' }
          ]}
          data={printData}
        />
      </div>
    );
    return createPortal(content, document.body);
  }

  return (
    <MainLayout
      title="ประวัติการเคลื่อนไหวยา"
      subtitle={`ทั้งหมด ${total} รายการ`}
    >
      {/* Type filter cards */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <button onClick={() => { setFilterType(''); setPage(1); }}
          className={`card px-4 py-2.5 text-sm font-medium transition-all ${!filterType ? 'ring-2 ring-primary-400 border-primary-200' : 'hover:border-primary-200'}`}>
          ทั้งหมด <span className="ml-1 text-xs text-slate-400">({total})</span>
        </button>
        {Object.entries(TX_CONFIG).map(([type, { label, variant }]) => (
          <button key={type} onClick={() => { setFilterType(filterType === type ? '' : type); setPage(1); }}
            className={`card px-4 py-2.5 transition-all ${filterType === type ? 'ring-2 ring-primary-400 border-primary-200' : 'hover:border-primary-200'}`}>
            <Badge variant={variant}>{label}</Badge>
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card className="mb-5">
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-48">
            <Input placeholder="ค้นหาชื่อยา, เลขอ้างอิง..." value={search}
              onChange={(e) => setSearch(e.target.value)} icon={<Search size={13} />} />
          </div>
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
          <span className="text-slate-400 text-sm self-center">–</span>
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
          <Button variant="secondary" onClick={() => {
            setSearch(''); setFilterType('');
            setDateFrom(thaiDaysAgo(7));
            setDateTo(thaiToday()); setPage(1);
          }}>ล้าง</Button>
          <div className="flex gap-2 ml-auto">
            <Button variant="secondary" onClick={handleExportCSV} disabled={exporting} icon={<Download size={13} />}>
              CSV
            </Button>
            <Button variant="secondary" onClick={handleExportPDF} disabled={exporting} icon={<Download size={13} />}>
              PDF
            </Button>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Activity size={36} />} title="ไม่พบรายการ" />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['วันเวลา', 'ประเภท', 'ชื่อยา', 'จำนวน', 'ก่อน → หลัง', 'เลขอ้างอิง', 'ผู้ดำเนินการ', 'หมายเหตุ'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((tx) => {
                  const tc = TX_CONFIG[tx.tx_type];
                  const isPositive = tx.tx_type === 'in' || tx.tx_type === 'return';
                  return (
                    <tr key={tx.tx_id} className="table-row-hover cursor-pointer" onClick={() => setSelectedTx(tx)}>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {safeDate(tx.created_at, true)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={tc.variant} className="gap-1.5">{tc.icon}{tc.label}</Badge>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {tx.med_showname || tx.med_name}
                        {tx.med_generic_name && <p className="text-xs text-slate-400 font-normal">{tx.med_generic_name}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive ? '+' : ''}{tx.quantity.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-500">
                        {tx.balance_before.toLocaleString()} <span className="text-slate-300">→</span>{' '}
                        <span className="text-slate-700 font-semibold">{tx.balance_after.toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {tx.reference_no || tx.prescription_no || tx.ward_from || '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{tx.performed_by_name || '-'}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 max-w-36 truncate">{tx.note || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {Math.ceil(total / perPage) > 1 && (
              <div className="flex justify-between items-center px-4 py-3 border-t border-slate-100">
                <p className="text-xs text-slate-500">หน้า {page}/{Math.ceil(total / perPage)} ({total} รายการ)</p>
                <div className="flex gap-1">
                  <Button variant="secondary" size="xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>◀</Button>
                  <Button variant="secondary" size="xs" disabled={page >= Math.ceil(total / perPage)} onClick={() => setPage(p => p + 1)}>▶</Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
      {/* Detail Drawer */}
      {(() => {
        const tx = selectedTx;
        const tc = tx ? TX_CONFIG[tx.tx_type] : null;
        const isPositive = tx?.tx_type === 'in' || tx?.tx_type === 'return';
        return (
          <DetailDrawer
            open={!!tx} onClose={() => setSelectedTx(null)}
            title={tx ? (tx.med_showname || tx.med_name) : ''}
            subtitle={tx ? safeDate(tx.created_at, true) : ''}
          >
            {tx && (
              <>
                <DrawerSection title="รายละเอียดการเคลื่อนไหว">
                  <DrawerGrid items={[
                    { label: 'ประเภท',
                      value: tc ? <Badge variant={tc.variant} className="gap-1.5">{tc.icon}{tc.label}</Badge> : tx.tx_type },
                    { label: 'จำนวน',
                      value: <span className={`font-bold text-base ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {isPositive ? '+' : ''}{tx.quantity.toLocaleString()}
                      </span> },
                    { label: 'สต็อกก่อน',   value: tx.balance_before.toLocaleString() },
                    { label: 'สต็อกหลัง',   value: <span className="font-semibold">{tx.balance_after.toLocaleString()}</span> },
                    { label: 'ชื่อยา',       value: <><p className="font-medium">{tx.med_showname || tx.med_name}</p>{tx.med_generic_name && <p className="text-xs text-slate-400">{tx.med_generic_name}</p>}</>, span: true },
                    { label: 'เลขอ้างอิง',  value: tx.reference_no || '—' },
                    { label: 'เลขใบสั่งยา', value: tx.prescription_no || '—' },
                    { label: 'Ward',          value: tx.ward_from || '—' },
                    { label: 'Lot Number',    value: tx.lot_number || '—' },
                    { label: 'วันหมดอายุ (lot)', value: safeDate(tx.expiry_date) },
                    { label: 'ผู้ดำเนินการ', value: tx.performed_by_name || '—' },
                    { label: 'วันเวลา',      value: safeDate(tx.created_at, true), span: true },
                    { label: 'หมายเหตุ',     value: tx.note || '—', span: true },
                  ]} />
                </DrawerSection>
              </>
            )}
          </DetailDrawer>
        );
      })()}
    </MainLayout>
  );
}
