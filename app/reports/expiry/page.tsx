'use client';
import { useState, useCallback, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
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

// ── PDF / CSV export helpers ──────────────────────────────────────────────────
const toB64 = (buf: ArrayBuffer) => {
  const b = new Uint8Array(buf); let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
};

async function exportPDF(title: string, columns: string[], rows: string[][]) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const [regularBuf, boldBuf, logoBuf] = await Promise.all([
    fetch('/font/ThaiSarabun/subset-Sarabun-Regular.ttf').then(r => r.arrayBuffer()),
    fetch('/font/ThaiSarabun/subset-Sarabun-Bold.ttf').then(r => r.arrayBuffer()),
    fetch('/logo.png').then(r => r.arrayBuffer()).catch(() => null),
  ]);
  doc.addFileToVFS('Sarabun.ttf', toB64(regularBuf));
  doc.addFont('Sarabun.ttf', 'Sarabun', 'normal');
  doc.addFileToVFS('Sarabun-Bold.ttf', toB64(boldBuf));
  doc.addFont('Sarabun-Bold.ttf', 'Sarabun', 'bold');

  const W = doc.internal.pageSize.getWidth();
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

  autoTable(doc, {
    startY: 42,
    head: [columns],
    body: rows,
    styles: { font: 'Sarabun', fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { font: 'Sarabun', fontStyle: 'bold', fillColor: [0, 111, 198], textColor: 255, fontSize: 8 },
    alternateRowStyles: { fillColor: [240, 247, 255] },
    margin: { top: 42, left: 10, right: 10, bottom: 15 },
    didDrawPage: drawHeader,
  });

  doc.save(`${title}.pdf`);
}

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
    let columns: string[];
    let rows: string[][];

    if (tab === 'low_stock') {
      columns = ['ชื่อยา', 'ชื่อสามัญ', 'หมวด', 'สต็อกปัจจุบัน', 'สต็อกขั้นต่ำ', 'ตำแหน่ง', 'สถานะ'];
      rows = data.map(r => {
        const ratio = r.min_quantity ? r.current_stock / r.min_quantity : 1;
        const status = r.current_stock === 0 ? 'หมดสต็อก' : ratio <= 0.5 ? 'วิกฤต' : 'ต่ำกว่าขั้นต่ำ';
        return [
          r.drug_name ?? '-',
          r.med_generic_name ?? '-',
          r.category ?? '-',
          `${r.current_stock} ${r.unit ?? ''}`.trim(),
          String(r.min_quantity ?? '-'),
          r.location ?? '-',
          status,
        ];
      });
    } else {
      columns = ['ชื่อยา', 'ชื่อสามัญ', 'Lot Number', 'คงเหลือ', 'วันหมดอายุ', 'วันรับเข้า', 'ตำแหน่ง', 'สถานะ'];
      rows = data.map(r => {
        const daysText = r.days_to_expiry != null
          ? (r.days_to_expiry < 0 ? `หมดอายุไป ${Math.abs(r.days_to_expiry)} วัน` : `อีก ${r.days_to_expiry} วัน`)
          : '';
        const expDate = r.exp_date ? `${safeDate(r.exp_date)} ${daysText}`.trim() : '—';
        return [
          r.drug_name ?? '-',
          r.med_generic_name ?? '-',
          r.lot_number ?? '-',
          `${r.quantity} ${r.unit ?? ''}`.trim(),
          expDate,
          safeDate(r.received_at),
          r.location ?? '-',
          EXP_STYLE[r.exp_status]?.label ?? r.exp_status ?? '-',
        ];
      });
    }

    setExporting(type);
    try {
      if (type === 'pdf') await exportPDF(title, columns, rows);
      else exportCSV(title, columns, rows);
    } catch (e: any) {
      toast.error('ออกรายงานไม่สำเร็จ: ' + e.message);
    } finally { setExporting(null); }
  };

  const isLotTab = tab !== 'low_stock';

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
