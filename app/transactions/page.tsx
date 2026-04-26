'use client';
import { useEffect, useState, useCallback } from 'react';
import MainLayout from '@/components/MainLayout';
import { Input, Select, Card, Badge, Button, EmptyState, Spinner } from '@/components/ui';
import DetailDrawer, { DrawerSection, DrawerGrid } from '@/components/DetailDrawer';
import { stockApi, type StockTransaction } from '@/lib/api';
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
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

      const [regularBuf, boldBuf, logoBuf] = await Promise.all([
        fetch('/font/ThaiSarabun/subset-Sarabun-Regular.ttf').then(r => r.arrayBuffer()),
        fetch('/font/ThaiSarabun/subset-Sarabun-Bold.ttf').then(r => r.arrayBuffer()),
        fetch('/logo.png').then(r => r.arrayBuffer()).catch(() => null),
      ]);
      const toB64 = (buf: ArrayBuffer) => {
        const b = new Uint8Array(buf); let s = '';
        for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
        return btoa(s);
      };
      doc.addFileToVFS('Sarabun.ttf', toB64(regularBuf));
      doc.addFont('Sarabun.ttf', 'Sarabun', 'normal');
      doc.addFileToVFS('Sarabun-Bold.ttf', toB64(boldBuf));
      doc.addFont('Sarabun-Bold.ttf', 'Sarabun', 'bold');

      const W = doc.internal.pageSize.getWidth();
      const title = 'รายงานประวัติการเคลื่อนไหวยา';
      const currentDate = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

      const drawHeader = (data: any) => {
        const pageCount = (doc.internal as any).getNumberOfPages();
        if (logoBuf) { try { doc.addImage(toB64(logoBuf), 'PNG', 10, 8, 20, 20); } catch {} }
        doc.setFont('Sarabun', 'bold'); doc.setFontSize(13);
        doc.text('โรงพยาบาลวัดห้วยปลากั้งเพื่อสังคม', W / 2, 14, { align: 'center' });
        doc.setFont('Sarabun', 'normal'); doc.setFontSize(9);
        doc.text('553 11 ตำบล บ้านดู่ อำเภอเมืองเชียงราย เชียงราย 57100', W / 2, 20, { align: 'center' });
        doc.text(`โทร: 052 029 888   |   วันที่: ${currentDate}`, W / 2, 26, { align: 'center' });
        doc.setFont('Sarabun', 'bold'); doc.setFontSize(11);
        doc.text(title, W / 2, 34, { align: 'center' });
        doc.setDrawColor('#006FC6'); doc.setLineWidth(0.4);
        doc.line(10, 38, W - 10, 38);
        doc.setFont('Sarabun', 'normal'); doc.setFontSize(8); doc.setTextColor(150);
        doc.text(`หน้า ${data.pageNumber} จาก ${pageCount}`, W - 10, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
        doc.setTextColor(0);
      };

      const columns = ['วันเวลา', 'ประเภท', 'ชื่อยา', 'จำนวน', 'ก่อน→หลัง', 'เลขอ้างอิง', 'ผู้ดำเนินการ'];
      const body = rows.map(t => [
        safeDate(t.created_at, true),
        TX_LABEL[t.tx_type] ?? t.tx_type,
        t.med_showname || t.med_name,
        (t.tx_type === 'in' || t.tx_type === 'return' ? '+' : '') + t.quantity.toLocaleString(),
        `${t.balance_before.toLocaleString()} → ${t.balance_after.toLocaleString()}`,
        t.reference_no || t.prescription_no || t.ward_from || '-',
        t.performed_by_name || '-',
      ]);

      autoTable(doc, {
        startY: 42,
        head: [columns],
        body,
        styles: { font: 'Sarabun', fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { font: 'Sarabun', fontStyle: 'bold', fillColor: [0, 111, 198], textColor: 255, fontSize: 8 },
        alternateRowStyles: { fillColor: [240, 247, 255] },
        margin: { top: 42, left: 10, right: 10, bottom: 15 },
        didDrawPage: drawHeader,
      });

      doc.save(`ประวัติเคลื่อนไหวยา_${dateFrom}_${dateTo}.pdf`);
    } catch (err: any) { toast.error('ออก PDF ไม่สำเร็จ: ' + err.message); }
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
