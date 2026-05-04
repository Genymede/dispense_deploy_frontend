'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import MainLayout from '@/components/MainLayout';
import ReportPrintTemplate from '@/components/ReportPrintTemplate';
import { Card, Button, Input, Select, Badge, Spinner, EmptyState } from '@/components/ui';
import { reportApi, stockApi, exportApi, type InventoryItem } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import {
  BarChart3, PieChartIcon, TrendingUp, Package,
  FileSpreadsheet, FileText, Download,
} from 'lucide-react';
import { thaiToday, thaiDaysAgo, fmtDate, fmtDateLabel } from '@/lib/dateUtils';
import toast from 'react-hot-toast';

const COLORS = ['#006fc6', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0284c7', '#db2777'];
type Tab = 'overview' | 'stock' | 'dispense' | 'inventory';

function ExportBar({ report, dateFrom, dateTo, ward, txType, onPrint }: {
  report: string; dateFrom?: string; dateTo?: string; ward?: string; txType?: string; onPrint?: () => void;
}) {
  const dl = (type: 'excel' | 'pdf') => {
    if (type === 'pdf' && onPrint) {
      onPrint();
      return;
    }
    const params: any = { report, date_from: dateFrom, date_to: dateTo };
    if (ward) params.ward = ward;
    if (txType) params.tx_type = txType;
    const url = type === 'excel' ? exportApi.excel(params) : exportApi.pdf(params);
    window.open(url, '_blank');
    toast.success(`กำลังดาวน์โหลด ${type === 'excel' ? 'Excel' : 'PDF'}...`);
  };
  return (
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" icon={<FileSpreadsheet size={13} />} onClick={() => dl('excel')}>Excel</Button>
      <Button variant="secondary" size="sm" icon={<FileText size={13} />} onClick={() => dl('pdf')}>PDF</Button>
    </div>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [dateFrom, setDateFrom] = useState(thaiDaysAgo(30));
  const [dateTo, setDateTo] = useState(thaiToday());
  const [filterWard, setFilterWard] = useState('');
  const [filterTxType, setFilterTxType] = useState('');

  const [stockSummary, setStockSummary] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [wardData, setWardData] = useState<any[]>([]);
  const [topDrugs, setTopDrugs] = useState<any[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [dispenseReport, setDispenseReport] = useState<any[]>([]);
  const [stockReport, setStockReport] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = useCallback(() => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 300);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'overview') {
        const [sumRes, catRes, topRes, wardRes] = await Promise.all([
          stockApi.getSummary(30),
          reportApi.getByCategory({ date_from: dateFrom, date_to: dateTo }),
          reportApi.getTopDrugs({ date_from: dateFrom, date_to: dateTo, limit: 10 }),
          reportApi.getByWard({ date_from: dateFrom, date_to: dateTo }),
        ]);
        setStockSummary(sumRes.data.map(r => ({
          date: fmtDateLabel(r.date),
          รับเข้า: Number(r.stock_in),
          จ่ายออก: Number(r.stock_out),
          คืนยา: Number(r.stock_return),
        })));
        setCategoryData(catRes.data.map(r => ({ name: r.category, value: Number(r.total_dispensed) })));
        setTopDrugs(topRes.data);
        setWardData(wardRes.data.map(r => ({ ward: r.ward, จำนวน: Number(r.prescription_count) })));
      } else if (tab === 'stock') {
        const [sumRes, topRes, rptRes] = await Promise.all([
          stockApi.getSummary(30),
          reportApi.getTopDrugs({ date_from: dateFrom, date_to: dateTo, limit: 10 }),
          reportApi.getStockReport({ date_from: dateFrom, date_to: dateTo, tx_type: filterTxType || undefined }),
        ]);
        setStockSummary(sumRes.data.map(r => ({
          date: fmtDateLabel(r.date),
          รับเข้า: Number(r.stock_in), จ่ายออก: Number(r.stock_out),
        })));
        setTopDrugs(topRes.data);
        setStockReport(rptRes.data);
      } else if (tab === 'dispense') {
        const [wardRes, dispRes] = await Promise.all([
          reportApi.getByWard({ date_from: dateFrom, date_to: dateTo }),
          reportApi.getDispenseReport({ date_from: dateFrom, date_to: dateTo, ward: filterWard || undefined }),
        ]);
        setWardData(wardRes.data.map(r => ({ ward: r.ward, จำนวน: Number(r.prescription_count) })));
        setDispenseReport(dispRes.data);
      } else if (tab === 'inventory') {
        const res = await reportApi.getInventoryReport();
        setInventory(res.data);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally { setLoading(false); }
  }, [tab, dateFrom, dateTo, filterWard, filterTxType]);

  useEffect(() => { load(); }, [load]);

  const TABS = [
    { key: 'overview', label: 'ภาพรวม', icon: <BarChart3 size={15} /> },
    { key: 'stock', label: 'ความเคลื่อนไหวสต็อก', icon: <TrendingUp size={15} /> },
    { key: 'dispense', label: 'การจ่ายยา', icon: <Package size={15} /> },
    { key: 'inventory', label: 'คงคลัง', icon: <PieChartIcon size={15} /> },
  ] as const;

  const totalInventoryValue = inventory.reduce((s, r) => s + Number(r.total_value || 0), 0);
  const totalStockIn = stockSummary.reduce((s, r) => s + (r.รับเข้า ?? 0), 0);
  const totalStockOut = stockSummary.reduce((s, r) => s + (r.จ่ายออก ?? 0), 0);

  const TX_LABEL: Record<string, string> = { in: 'รับเข้า', out: 'จ่ายออก', adjust: 'ปรับสต็อก', return: 'คืนยา', expired: 'หมดอายุ' };
  const STATUS_TH: Record<string, string> = { pending: 'รอจ่าย', dispensed: 'จ่ายแล้ว', returned: 'คืนยา', cancelled: 'ยกเลิก' };

  if (isPrinting) {
    return (
      <div className="bg-white min-h-screen text-black">
        {tab === 'stock' && (
          <ReportPrintTemplate
            title="รายงานความเคลื่อนไหวสต็อกยา"
            dateRange={`ตั้งแต่ ${dateFrom} ถึง ${dateTo}`}
            columns={[
              { label: 'วันเวลา', key: 'created_at', render: r => fmtDate(r.created_at, true) },
              { label: 'ประเภท', key: 'tx_type', render: r => TX_LABEL[r.tx_type] ?? r.tx_type },
              { label: 'ชื่อยา', key: 'drug_name' },
              { label: 'จำนวน', key: 'quantity', render: r => (r.tx_type === 'in' || r.tx_type === 'return' ? '+' : '') + r.quantity },
              { label: 'ยอดคงเหลือ', key: 'balance', render: r => `${r.balance_before} -> ${r.balance_after}` },
              { label: 'อ้างอิง', key: 'ref', render: r => r.reference_no || r.prescription_no || '-' },
              { label: 'ผู้บันทึก', key: 'performed_by_name', render: r => r.performed_by_name || '-' }
            ]}
            data={stockReport}
          />
        )}
        {tab === 'dispense' && (
          <ReportPrintTemplate
            title="รายงานการจ่ายยา"
            dateRange={`ตั้งแต่ ${dateFrom} ถึง ${dateTo}`}
            columns={[
              { label: 'เลขใบสั่ง', key: 'prescription_no' },
              { label: 'วันที่', key: 'created_at', render: r => fmtDate(r.created_at) },
              { label: 'ผู้ป่วย', key: 'patient_name', render: r => r.patient_name || '-' },
              { label: 'HN', key: 'hn_number', render: r => r.hn_number || '-' },
              { label: 'วอร์ด', key: 'ward', render: r => r.ward || '-' },
              { label: 'สถานะ', key: 'status', render: r => STATUS_TH[r.status] ?? r.status },
              { label: 'รายการ', key: 'item_count', render: r => `${r.item_count} รายการ` }
            ]}
            data={dispenseReport}
            summaryItems={[
              { label: 'จำนวนทั้งหมด', value: dispenseReport.length },
              { label: 'จ่ายแล้ว', value: dispenseReport.filter(r => r.status === 'dispensed').length },
              { label: 'รอจ่าย', value: dispenseReport.filter(r => r.status === 'pending').length },
              { label: 'ยกเลิก', value: dispenseReport.filter(r => r.status === 'cancelled').length },
            ]}
          />
        )}
        {tab === 'inventory' && (
          <ReportPrintTemplate
            title="รายงานมูลค่าคงคลัง"
            columns={[
               { label: 'ชื่อยา', key: 'med_name', render: r => r.med_showname || r.med_name },
               { label: 'หมวดหมู่', key: 'category', render: r => r.category || '-' },
               { label: 'คงเหลือ', key: 'current_stock', render: r => `${r.current_stock.toLocaleString()} ${r.unit}` },
               { label: 'ที่เก็บ', key: 'location', render: r => r.location || '-' },
               { label: 'มูลค่า', key: 'total_value', render: r => `฿${Number(r.total_value).toLocaleString('th', { minimumFractionDigits: 2 })}` },
               { label: 'สถานะ', key: 'stock_status', render: r => r.stock_status === 'normal' ? 'ปกติ' : r.stock_status === 'low_stock' ? 'ต่ำ' : r.stock_status === 'out_of_stock' ? 'หมด' : 'หมดอายุ' }
            ]}
            data={inventory}
            summaryItems={[
              { label: 'รายการทั้งหมด', value: inventory.length },
              { label: 'มูลค่าคงคลังรวม', value: `฿${totalInventoryValue.toLocaleString('th', { minimumFractionDigits: 0 })}` },
              { label: 'ต้องดำเนินการ', value: inventory.filter(r => r.stock_status !== 'normal').length },
            ]}
          />
        )}
        {tab === 'overview' && (
          <ReportPrintTemplate
            title="รายงานความเคลื่อนไหวรายวัน"
            dateRange={`ตั้งแต่ ${dateFrom} ถึง ${dateTo}`}
            columns={[
               { label: 'วันที่', key: 'date' },
               { label: 'รับเข้า', key: 'รับเข้า' },
               { label: 'จ่ายออก', key: 'จ่ายออก' },
            ]}
            data={stockSummary}
            summaryItems={[
              { label: 'รับเข้ารวม', value: totalStockIn.toLocaleString() },
              { label: 'จ่ายออกรวม', value: totalStockOut.toLocaleString() },
              { label: 'สัดส่วนจ่าย/รับ', value: totalStockIn > 0 ? `${((totalStockOut / totalStockIn) * 100).toFixed(1)}%` : '-' }
            ]}
          />
        )}
      </div>
    );
  }

  return (
    <MainLayout title="รายงานและสถิติ" subtitle="สรุปข้อมูลการบริหารคลังยาย่อย">
      {/* Date + quick range */}
      <Card className="mb-5">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-slate-600">ช่วงเวลา:</span>
          {[{ l: '7 วัน', d: 7 }, { l: '30 วัน', d: 30 }, { l: '90 วัน', d: 90 }, { l: '1 ปี', d: 365 }].map(({ l, d }) => (
            <button key={l} onClick={() => { setDateFrom(thaiDaysAgo(d)); setDateTo(thaiToday()); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:border-primary-400 hover:text-primary-600 transition-all">
              {l}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <span className="text-slate-400">–</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map(({ key, label, icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === key ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {icon}{label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size={28} /></div>
      ) : (
        <>
          {/* ══ OVERVIEW ════════════════════════════════════════════════════ */}
          {tab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'รับเข้า (30 วัน)', value: totalStockIn.toLocaleString(), color: 'text-primary-700' },
                  { label: 'จ่ายออก (30 วัน)', value: totalStockOut.toLocaleString(), color: 'text-green-700' },
                  { label: 'ใบสั่งยาช่วงนี้', value: dispenseReport.length || '—', color: 'text-amber-700' },
                  { label: 'สัดส่วนจ่าย/รับ', value: totalStockIn > 0 ? `${((totalStockOut / totalStockIn) * 100).toFixed(1)}%` : '—', color: 'text-purple-700' },
                ].map(({ label, value, color }) => (
                  <Card key={label}><p className="text-xs text-slate-500">{label}</p><p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p></Card>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">ความเคลื่อนไหวรายวัน (30 วัน)</h3>
                <ExportBar report="stock" dateFrom={dateFrom} dateTo={dateTo} onPrint={handlePrint} />
              </div>
              <Card>
                {stockSummary.length === 0 ? <EmptyState icon={<BarChart3 size={32} />} title="ยังไม่มีข้อมูล" /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={stockSummary} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="รับเข้า" fill="#006fc6" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="จ่ายออก" fill="#16a34a" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>

              <div className="grid grid-cols-2 gap-5">
                <Card>
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">การจ่ายยาตามหมวดหมู่</h3>
                  {categoryData.length === 0 ? <EmptyState icon={<PieChartIcon size={28} />} title="ยังไม่มีข้อมูล" /> : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                          {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </Card>
                <Card>
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">การจ่ายยาตามวอร์ด</h3>
                  {wardData.length === 0 ? <EmptyState icon={<BarChart3 size={28} />} title="ยังไม่มีข้อมูล" /> : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={wardData} layout="vertical" margin={{ left: 16, right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis dataKey="ward" type="category" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={80} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <Bar dataKey="จำนวน" fill="#006fc6" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Card>
              </div>
            </div>
          )}

          {/* ══ STOCK ═══════════════════════════════════════════════════════ */}
          {tab === 'stock' && (
            <div className="space-y-5">
              {/* filter + export */}
              <Card>
                <div className="flex items-center gap-3 flex-wrap">
                  <Select placeholder="ทุกประเภท" value={filterTxType} onChange={e => setFilterTxType(e.target.value)}
                    options={Object.entries(TX_LABEL).map(([v, l]) => ({ value: v, label: l }))} />
                  <div className="ml-auto"><ExportBar report="stock" dateFrom={dateFrom} dateTo={dateTo} txType={filterTxType} onPrint={handlePrint} /></div>
                </div>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold text-slate-700 mb-4">แนวโน้มสต็อก</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={stockSummary} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="รับเข้า" stroke="#006fc6" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="จ่ายออก" stroke="#16a34a" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <Card className="overflow-hidden p-0">
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-700">รายการธุรกรรม ({stockReport.length})</h3>
                </div>
                {stockReport.length === 0 ? <EmptyState icon={<TrendingUp size={32} />} title="ไม่มีข้อมูล" /> : (
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                        <tr>{['วันเวลา', 'ประเภท', 'ชื่อยา', 'จำนวน', 'ก่อน→หลัง', 'อ้างอิง', 'ผู้บันทึก'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {stockReport.slice(0, 100).map((r: any) => (
                          <tr key={r.tx_id} className="table-row-hover">
                            <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">{fmtDate(r.created_at, true)}</td>
                            <td className="px-4 py-2"><Badge variant={r.tx_type === 'in' ? 'success' : r.tx_type === 'out' ? 'info' : r.tx_type === 'expired' ? 'danger' : 'gray'}>{TX_LABEL[r.tx_type] ?? r.tx_type}</Badge></td>
                            <td className="px-4 py-2 font-medium text-slate-800">{r.drug_name}</td>
                            <td className="px-4 py-2"><span className={r.tx_type === 'in' || r.tx_type === 'return' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{r.tx_type === 'in' || r.tx_type === 'return' ? '+' : ''}{r.quantity}</span></td>
                            <td className="px-4 py-2 text-xs font-mono text-slate-500">{r.balance_before}→<span className="font-bold text-slate-700">{r.balance_after}</span></td>
                            <td className="px-4 py-2 text-xs text-slate-500">{r.reference_no || r.prescription_no || '-'}</td>
                            <td className="px-4 py-2 text-xs text-slate-500">{r.performed_by_name || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {stockReport.length > 100 && <p className="text-center text-xs text-slate-400 py-3">แสดง 100/{stockReport.length} — Export Excel เพื่อดูทั้งหมด</p>}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ══ DISPENSE ════════════════════════════════════════════════════ */}
          {tab === 'dispense' && (
            <div className="space-y-5">
              <Card>
                <div className="flex items-center gap-3 flex-wrap">
                  <Input placeholder="กรองวอร์ด..." value={filterWard} onChange={e => setFilterWard(e.target.value)} className="w-48" />
                  <div className="ml-auto"><ExportBar report="dispense" dateFrom={dateFrom} dateTo={dateTo} ward={filterWard} onPrint={handlePrint} /></div>
                </div>
              </Card>

              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'ทั้งหมด', value: dispenseReport.length },
                  { label: 'จ่ายแล้ว', value: dispenseReport.filter(r => r.status === 'dispensed').length },
                  { label: 'รอจ่าย', value: dispenseReport.filter(r => r.status === 'pending').length },
                  { label: 'ยกเลิก', value: dispenseReport.filter(r => r.status === 'cancelled').length },
                ].map(({ label, value }) => (
                  <Card key={label} className="text-center py-4">
                    <p className="text-2xl font-bold text-primary-700">{value}</p>
                    <p className="text-xs text-slate-500 mt-1">{label}</p>
                  </Card>
                ))}
              </div>

              <Card>
                <h3 className="text-sm font-semibold text-slate-700 mb-4">การจ่ายยาตามวอร์ด</h3>
                {wardData.length === 0 ? <EmptyState icon={<BarChart3 size={32} />} title="ยังไม่มีข้อมูล" /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={wardData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="ward" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="จำนวน" fill="#006fc6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>

              <Card className="overflow-hidden p-0">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-700">รายการใบสั่งยา ({dispenseReport.length})</h3>
                </div>
                {dispenseReport.length === 0 ? <EmptyState icon={<Package size={32} />} title="ไม่มีข้อมูล" /> : (
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                        <tr>{['เลขใบสั่ง', 'วันที่', 'ผู้ป่วย', 'HN', 'วอร์ด', 'สถานะ', 'รายการ'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {dispenseReport.slice(0, 100).map((r: any) => (
                          <tr key={r.prescription_id} className="table-row-hover">
                            <td className="px-4 py-2 font-mono text-xs text-primary-700">{r.prescription_no}</td>
                            <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                            <td className="px-4 py-2 font-medium text-slate-800">{r.patient_name || 'ไม่ระบุ'}</td>
                            <td className="px-4 py-2 text-xs text-slate-500">{r.hn_number || '-'}</td>
                            <td className="px-4 py-2 text-xs text-slate-600">{r.ward || '-'}</td>
                            <td className="px-4 py-2">
                              <Badge variant={r.status === 'dispensed' ? 'success' : r.status === 'cancelled' ? 'danger' : r.status === 'pending' ? 'warning' : 'gray'}>
                                {STATUS_TH[r.status] ?? r.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-2 text-xs text-slate-500">{r.item_count} รายการ</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {dispenseReport.length > 100 && <p className="text-center text-xs text-slate-400 py-3">แสดง 100/{dispenseReport.length} — Export Excel เพื่อดูทั้งหมด</p>}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ══ INVENTORY ═══════════════════════════════════════════════════ */}
          {tab === 'inventory' && (
            <div className="space-y-5">
              <div className="flex justify-between items-center">
                <div className="grid grid-cols-3 gap-4 flex-1 mr-4">
                  {[
                    { label: 'รายการทั้งหมด', value: inventory.length },
                    { label: 'มูลค่าคงคลังรวม', value: `฿${totalInventoryValue.toLocaleString('th', { minimumFractionDigits: 0 })}` },
                    { label: 'ต้องดำเนินการ', value: inventory.filter(r => r.stock_status !== 'normal').length },
                  ].map(({ label, value }) => (
                    <Card key={label}><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-bold text-slate-800 mt-1">{value}</p></Card>
                  ))}
                </div>
                <ExportBar report="inventory" onPrint={handlePrint} />
              </div>

              <Card className="overflow-hidden p-0">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-700">รายการคงคลัง</h3>
                </div>
                {inventory.length === 0 ? <EmptyState icon={<Package size={36} />} title="ไม่มีข้อมูล" /> : (
                  <div className="overflow-x-auto max-h-[600px]">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                        <tr>{['ชื่อยา', 'หมวดหมู่', 'คงเหลือ', 'ขั้นต่ำ', 'ที่เก็บ', 'วันหมดอายุ', 'มูลค่า', 'สถานะ'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {inventory.map(d => (
                          <tr key={d.med_sid} className="table-row-hover">
                            <td className="px-4 py-2.5">
                              <p className="font-medium text-slate-800">{d.med_showname || d.med_name}</p>
                              <p className="text-xs text-slate-400">{d.med_generic_name}</p>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-slate-500">{d.category || '-'}</td>
                            <td className="px-4 py-2.5 font-semibold text-slate-800">{d.current_stock.toLocaleString()} <span className="text-slate-400 text-xs font-normal">{d.unit}</span></td>
                            <td className="px-4 py-2.5 text-xs text-slate-500">{d.min_quantity ?? '-'}</td>
                            <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{d.location || '-'}</td>
                            <td className="px-4 py-2.5 text-xs text-slate-500">{fmtDate(d.exp_date)}</td>
                            <td className="px-4 py-2.5 text-xs font-semibold text-primary-700">฿{Number(d.total_value).toLocaleString('th', { minimumFractionDigits: 2 })}</td>
                            <td className="px-4 py-2.5">
                              <Badge variant={d.stock_status === 'normal' ? 'success' : d.stock_status === 'low_stock' ? 'warning' : 'danger'} dot>
                                {d.stock_status === 'normal' ? 'ปกติ' : d.stock_status === 'low_stock' ? 'ต่ำ' : d.stock_status === 'out_of_stock' ? 'หมด' : 'หมดอายุ'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}
          {/* ══ PRINT TEMPLATES ═════════════════════════════════════════════ */}
        </>
      )}
    </MainLayout>
  );
}
