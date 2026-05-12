'use client';
import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import MainLayout from '@/components/MainLayout';
import ReportPrintTemplate from '@/components/ReportPrintTemplate';
import { Card, Button, Spinner, EmptyState } from '@/components/ui';
import { stockApi } from '@/lib/api';
import { fmtDate } from '@/lib/dateUtils';
import { AlertTriangle, PackageX, TrendingDown, RefreshCw, FileText, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';

const TABS = [
  { key: 'all',        label: 'ทั้งหมด',             icon: <RefreshCw size={14}/>,      badge: null      },
  { key: 'expired',    label: 'หมดอายุแล้ว',          icon: <PackageX size={14}/>,       badge: 'danger'  },
  { key: 'near_expiry',label: 'ใกล้หมดอายุ (90 วัน)', icon: <AlertTriangle size={14}/>,  badge: 'warning' },
  { key: 'low_stock',  label: 'ใกล้หมดสต็อก',         icon: <TrendingDown size={14}/>,   badge: 'info'    },
] as const;

type TabKey = typeof TABS[number]['key'];

const TAB_TITLES: Record<TabKey, string> = {
  all:         'รายงานยาทั้งหมด (Lot)',
  expired:     'รายงานยาหมดอายุแล้ว',
  near_expiry: 'รายงานยาใกล้หมดอายุ (90 วัน)',
  low_stock:   'รายงานยาใกล้หมดสต็อก',
};

const EXP_STYLE: Record<string, { cls: string; label: string }> = {
  expired:   { cls: 'bg-red-100 text-red-700',       label: 'หมดอายุ'         },
  critical:  { cls: 'bg-orange-100 text-orange-700', label: 'วิกฤต (<30 วัน)' },
  warning:   { cls: 'bg-amber-100 text-amber-700',   label: 'ใกล้หมด (≤90 วัน)' },
  ok:        { cls: 'bg-green-100 text-green-700',   label: 'ปกติ'            },
  no_expiry: { cls: 'bg-slate-100 text-slate-500',   label: 'ไม่ระบุ'         },
};

const safeDate = (val: any) => fmtDate(val);

// ── CSV export helper ─────────────────────────────────────────────────────────
function exportCSV(title: string, columns: string[], rows: string[][]) {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = '\uFEFF' + [columns.map(esc), ...rows.map(r => r.map(esc))].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${title}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function ExpiryReportPage() {
  const [tab, setTab] = useState<TabKey>('all');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);
  const [counts, setCounts] = useState<Record<TabKey, number>>({ all: 0, expired: 0, near_expiry: 0, low_stock: 0 });
  const [isPrinting, setIsPrinting] = useState(false);
  const [printData, setPrintData] = useState<any[]>([]);
  const [printCols, setPrintCols] = useState<{ label: string; key: string; render?: (r: any) => string }[]>([]);
  const [printTitle, setPrintTitle] = useState('');

  const load = useCallback(async (t: TabKey) => {
    setLoading(true);
    try {
      const res = await stockApi.getLotsReport({ type: t as any, days: 90 });
      setData(res.data.data);
    } catch (e: any) {
      toast.error(e.message || 'โหลดข้อมูลไม่สำเร็จ');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    Promise.all(TABS.map(t => stockApi.getLotsReport({ type: t.key as any, days: 90 }))).then(results => {
      const c = {} as Record<TabKey, number>;
      TABS.forEach((t, i) => { c[t.key] = results[i].data.data.length; });
      setCounts(c);
    }).catch(() => {});
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  // ── Build export rows ────────────────────────────────────────────────────────
  const handleExport = async (type: 'pdf' | 'csv') => {
    const title = TAB_TITLES[tab];
    setExporting(type);
    try {
      const res = await stockApi.getLotsReport({ type: tab as any, days: 90 });
      const allData = res.data.data;

      if (type === 'pdf') {
        const cols = tab === 'low_stock'
          ? [
              { label: 'ชื่อยา', key: 'drug_name', render: (r: any) => r.drug_name ?? '-' },
              { label: 'ชื่อสามัญ', key: 'med_generic_name', render: (r: any) => r.med_generic_name ?? '-' },
              { label: 'หมวด', key: 'category', render: (r: any) => r.category ?? '-' },
              { label: 'สต็อกปัจจุบัน', key: 'current_stock', render: (r: any) => `${r.current_stock} ${r.unit ?? ''}`.trim() },
              { label: 'สต็อกขั้นต่ำ', key: 'min_quantity', render: (r: any) => String(r.min_quantity ?? '-') },
              { label: 'ตำแหน่ง', key: 'location', render: (r: any) => r.location ?? '-' },
              { label: 'สถานะ', key: '_status', render: (r: any) => { const ratio = r.min_quantity ? r.current_stock / r.min_quantity : 1; return r.current_stock === 0 ? 'หมดสต็อก' : ratio <= 0.5 ? 'วิกฤต' : 'ต่ำกว่าขั้นต่ำ'; } },
            ]
          : [
              { label: 'ชื่อยา', key: 'drug_name', render: (r: any) => r.drug_name ?? '-' },
              { label: 'ชื่อสามัญ', key: 'med_generic_name', render: (r: any) => r.med_generic_name ?? '-' },
              { label: 'Lot Number', key: 'lot_number', render: (r: any) => r.lot_number ?? '-' },
              { label: 'คงเหลือ', key: 'quantity', render: (r: any) => `${r.quantity} ${r.unit ?? ''}`.trim() },
              { label: 'วันหมดอายุ', key: 'exp_date', render: (r: any) => { const d = r.days_to_expiry != null ? (r.days_to_expiry < 0 ? ` (หมดอายุไป ${Math.abs(r.days_to_expiry)} วัน)` : ` (อีก ${r.days_to_expiry} วัน)`) : ''; return r.exp_date ? `${safeDate(r.exp_date)}${d}` : '—'; } },
              { label: 'วันรับเข้า', key: 'received_at', render: (r: any) => safeDate(r.received_at) },
              { label: 'ตำแหน่ง', key: 'location', render: (r: any) => r.location ?? '-' },
              { label: 'สถานะ', key: 'exp_status', render: (r: any) => EXP_STYLE[r.exp_status]?.label ?? r.exp_status ?? '-' },
            ];
        setPrintTitle(title);
        setPrintCols(cols);
        setPrintData(allData);
        setIsPrinting(true);
        setTimeout(() => { window.print(); setIsPrinting(false); }, 500);
      } else {
        const csvColumns = tab === 'low_stock'
          ? ['ชื่อยา', 'ชื่อสามัญ', 'หมวด', 'สต็อกปัจจุบัน', 'สต็อกขั้นต่ำ', 'ตำแหน่ง', 'สถานะ']
          : ['ชื่อยา', 'ชื่อสามัญ', 'Lot Number', 'คงเหลือ', 'วันหมดอายุ', 'วันรับเข้า', 'ตำแหน่ง', 'สถานะ'];
        const rows = tab === 'low_stock'
          ? allData.map((r: any) => { const ratio = r.min_quantity ? r.current_stock / r.min_quantity : 1; return [r.drug_name ?? '-', r.med_generic_name ?? '-', r.category ?? '-', `${r.current_stock} ${r.unit ?? ''}`.trim(), String(r.min_quantity ?? '-'), r.location ?? '-', r.current_stock === 0 ? 'หมดสต็อก' : ratio <= 0.5 ? 'วิกฤต' : 'ต่ำกว่าขั้นต่ำ']; })
          : allData.map((r: any) => { const d = r.days_to_expiry != null ? (r.days_to_expiry < 0 ? `หมดอายุไป ${Math.abs(r.days_to_expiry)} วัน` : `อีก ${r.days_to_expiry} วัน`) : ''; return [r.drug_name ?? '-', r.med_generic_name ?? '-', r.lot_number ?? '-', `${r.quantity} ${r.unit ?? ''}`.trim(), r.exp_date ? `${safeDate(r.exp_date)} ${d}`.trim() : '—', safeDate(r.received_at), r.location ?? '-', EXP_STYLE[r.exp_status]?.label ?? r.exp_status ?? '-']; });
        exportCSV(title, csvColumns, rows);
      }
    } catch (e: any) {
      toast.error('ออกรายงานไม่สำเร็จ: ' + e.message);
    } finally { setExporting(null); }
  };

  const isLotTab = tab !== 'low_stock';

  if (isPrinting) {
    return createPortal(
      <div className="print-only print-unbound bg-white text-black min-h-screen">
        <ReportPrintTemplate title={printTitle} columns={printCols} data={printData} />
      </div>,
      document.body,
    );
  }

  return (
    <MainLayout
      title="รายงานยาหมดอายุ / สต็อกต่ำ"
      subtitle="Expiry & Low Stock Report"
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<FileSpreadsheet size={13}/>}
            loading={exporting === 'csv'} onClick={() => handleExport('csv')}>CSV</Button>
          <Button variant="secondary" size="sm" icon={<FileText size={13}/>}
            loading={exporting === 'pdf'} onClick={() => handleExport('pdf')}>PDF</Button>
          <Button variant="secondary" size="sm" icon={<RefreshCw size={13}/>}
            onClick={() => load(tab)} loading={loading}>รีเฟรช</Button>
        </div>
      }
    >
      {/* Tab bar */}
      <div className="flex gap-1 mb-5 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map(({ key, label, icon, badge }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {icon}
            {label}
            {badge && counts[key] > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5 ${
                badge === 'danger'  ? 'bg-red-100 text-red-600'    :
                badge === 'warning' ? 'bg-amber-100 text-amber-700' :
                                      'bg-blue-100 text-blue-700'
              }`}>
                {counts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={28}/></div>
        ) : data.length === 0 ? (
          <EmptyState
            icon={tab === 'expired' ? <PackageX size={36}/> : tab === 'near_expiry' ? <AlertTriangle size={36}/> : <TrendingDown size={36}/>}
            title={tab === 'expired' ? 'ไม่มียาหมดอายุ' : tab === 'near_expiry' ? 'ไม่มียาใกล้หมดอายุ' : tab === 'low_stock' ? 'ไม่มียาที่สต็อกต่ำ' : 'ไม่พบรายการ'}
            description=""
          />
        ) : !isLotTab ? (
          /* Low stock table */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['ชื่อยา', 'หมวด', 'สต็อกปัจจุบัน', 'สต็อกขั้นต่ำ', 'ตำแหน่ง', 'สถานะ'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.map((row, i) => {
                  const ratio = row.min_quantity ? row.current_stock / row.min_quantity : 1;
                  return (
                    <tr key={i} className="table-row-hover">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{row.drug_name}</p>
                        {row.med_generic_name && <p className="text-xs text-slate-400">{row.med_generic_name}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{row.category || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold text-base ${row.current_stock === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                          {row.current_stock}
                        </span>
                        <span className="text-xs text-slate-400 ml-1">{row.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{row.min_quantity}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{row.location || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          row.current_stock === 0 ? 'bg-red-100 text-red-700'
                          : ratio <= 0.5 ? 'bg-orange-100 text-orange-700'
                          : 'bg-amber-100 text-amber-700'
                        }`}>
                          {row.current_stock === 0 ? 'หมดสต็อก' : ratio <= 0.5 ? 'วิกฤต' : 'ต่ำกว่าขั้นต่ำ'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
              แสดง {data.length} รายการ
            </div>
          </div>
        ) : (
          /* Lot table — expired / near_expiry / all */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['ชื่อยา', 'Lot Number', 'คงเหลือ', 'วันหมดอายุ', 'วันรับเข้า', 'ตำแหน่ง', 'สถานะ'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.map((row) => {
                  const st = EXP_STYLE[row.exp_status] ?? EXP_STYLE['ok'];
                  return (
                    <tr key={row.lot_id} className={`table-row-hover ${row.exp_status === 'expired' ? 'bg-red-50/50' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{row.drug_name}</p>
                        {row.med_generic_name && <p className="text-xs text-slate-400">{row.med_generic_name}</p>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {row.lot_number || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-800">{row.quantity}</span>
                        <span className="text-xs text-slate-400 ml-1">{row.unit}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className={`text-sm font-medium ${
                          row.exp_status === 'expired'  ? 'text-red-600'    :
                          row.exp_status === 'critical' ? 'text-orange-600' :
                          row.exp_status === 'warning'  ? 'text-amber-600'  : 'text-slate-700'
                        }`}>
                          {safeDate(row.exp_date)}
                        </p>
                        {row.days_to_expiry != null && (
                          <p className="text-[10px] text-slate-400">
                            {row.days_to_expiry < 0
                              ? `หมดอายุไป ${Math.abs(row.days_to_expiry)} วัน`
                              : `อีก ${row.days_to_expiry} วัน`}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{safeDate(row.received_at)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{row.location || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${st.cls}`}>{st.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
              แสดง {data.length} รายการ lot
            </div>
          </div>
        )}
      </Card>
    </MainLayout>
  );
}
