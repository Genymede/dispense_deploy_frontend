'use client';
import { useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Card, Input, Select, Button, Badge, EmptyState, Spinner, ConfirmDialog } from '@/components/ui';
import { Search, FileSpreadsheet, FileText, RefreshCw, Filter, Plus } from 'lucide-react';
import { format, subDays } from 'date-fns';
import toast from 'react-hot-toast';
import { exportApi } from '@/lib/api';
import ReportPrintTemplate from '@/components/ReportPrintTemplate';

// ── CSV helper ────────────────────────────────────────────────────────────────
function downloadCSV(filename: string, columns: string[], rows: string[][]) {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = '\uFEFF' + [columns.map(esc), ...rows.map(r => r.map(esc))].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ColDef {
  key: string;
  label: string;
  width?: string;
  render?: (row: any) => ReactNode;
  className?: string;
  exportValue?: (row: any) => string;  // plain text for PDF/CSV export
  skipExport?: boolean;                // omit column from export (e.g. action cols)
}

export interface FilterConfig {
  key: string;
  type: 'search' | 'select' | 'date';
  placeholder?: string;
  options?: { value: string; label: string }[];
  defaultValue?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function StatusBadge({ status, map }: {
  status: string;
  map: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'gray' | 'info' }>;
}) {
  const cfg = map[status] ?? { label: status, variant: 'gray' as const };
  return <Badge variant={cfg.variant} dot>{cfg.label}</Badge>;
}

export function DateRangeFilter({
  dateFrom, dateTo, onFromChange, onToChange,
}: { dateFrom: string; dateTo: string; onFromChange: (v: string) => void; onToChange: (v: string) => void; }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {[{ l: '7 วัน', d: 7 }, { l: '30 วัน', d: 30 }, { l: '90 วัน', d: 90 }].map(({ l, d }) => (
        <button key={l} onClick={() => { onFromChange(format(subDays(new Date(), d), 'yyyy-MM-dd')); onToChange(format(new Date(), 'yyyy-MM-dd')); }}
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:border-primary-400 hover:text-primary-600 transition-all">
          {l}
        </button>
      ))}
      <Input type="date" value={dateFrom} onChange={e => onFromChange(e.target.value)} />
      <span className="text-slate-400 text-sm">–</span>
      <Input type="date" value={dateTo} onChange={e => onToChange(e.target.value)} />
    </div>
  );
}

// ExportButtons — kept for backward compat (standalone usage)
export function ExportButtons({ report, params }: { report: string; params?: Record<string, string | undefined> }) {
  const { exportApi } = require('@/lib/api');
  const dl = (type: 'excel') => {
    const p = { report, ...params };
    Object.keys(p).forEach(k => (p as any)[k] === undefined && delete (p as any)[k]);
    window.open(exportApi.excel(p as any), '_blank');
    toast.success('กำลังดาวน์โหลด Excel...');
  };
  return (
    <Button variant="secondary" size="sm" icon={<FileSpreadsheet size={13} />} onClick={() => dl('excel')}>Excel</Button>
  );
}

// ─── DataTable ────────────────────────────────────────────────────────────────

interface DataTableProps {
  cols: ColDef[];
  fetcher: (params: { search?: string; page: number; limit: number; [k: string]: any }) => Promise<{ data: any[]; total: number }>;
  filters?: FilterConfig[];
  extraFilters?: ReactNode;
  exportTitle?: string;
  searchPlaceholder?: string;
  perPage?: number;
  emptyIcon?: ReactNode;
  emptyText?: string;
  deps?: any[];
  onAdd?: () => void;
  addLabel?: string;
  onDelete?: (row: any) => Promise<void>;
  deleteConfirmText?: (row: any) => string;
  actionCol?: (row: any) => ReactNode;
  onRowClick?: (row: any) => void;
  // backward compat
  reportType?: string;
  exportParams?: Record<string, string | undefined>;
}

const PAGE_SIZE_OPTIONS = [5, 10, 20, 40, 100];

export default function DataTable({
  cols, fetcher,
  filters = [], extraFilters,
  exportTitle,
  searchPlaceholder = 'ค้นหา...',
  perPage = 20,
  emptyIcon, emptyText = 'ไม่พบรายการ', deps = [],
  onAdd, addLabel = 'เพิ่มรายการ', onDelete, deleteConfirmText, actionCol, onRowClick,
  reportType, exportParams,
}: DataTableProps) {
  const [rows, setRows]       = useState<any[]>([]);
  const [total, setTotal]     = useState(0);
  const [search, setSearch]   = useState('');
  const [page, setPage]       = useState(1);
  const [limit, setLimit]     = useState(perPage);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);
  const [delTarget, setDelTarget] = useState<any | null>(null);
  const [deleting, setDeleting]   = useState(false);
  
  const [isPrinting, setIsPrinting] = useState(false);
  const [printData, setPrintData]   = useState<any[]>([]);

  // filter values managed by DataTable
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(filters.map(f => [f.key, f.defaultValue ?? '']))
  );
  const setFilter = (key: string, val: string) => {
    setFilterValues(prev => ({ ...prev, [key]: val }));
    setPage(1);
  };

  const timer = useRef<ReturnType<typeof setTimeout>>();

  const buildParams = useCallback((overrides?: object) => {
    const extra: Record<string, any> = {};
    filters.forEach(f => { if (filterValues[f.key]) extra[f.key] = filterValues[f.key]; });
    return { search, page, limit, ...extra, ...overrides };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page, limit, filterValues, ...deps]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetcher(buildParams());
      setRows(res.data);
      setTotal(res.total);
    } catch (err: any) {
      toast.error(err.message || 'โหลดข้อมูลล้มเหลว');
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildParams]);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(load, 300);
    return () => clearTimeout(timer.current);
  }, [load]);

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleExport = async (type: 'pdf' | 'csv') => {
    if (!exportTitle) return;
    setExporting(type);
    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
    const filename = `${exportTitle}_${timestamp}`;
    try {
      if (type === 'pdf') {
        // Full-page ReportPrintTemplate
        const res = await fetcher(buildParams({ page: 1, limit: 9999 }));
        setPrintData(res.data);
        setIsPrinting(true);
        setTimeout(() => {
          window.print();
          setIsPrinting(false);
        }, 500);
      } else {
        // CSV → fetch all data, build client-side
        const res = await fetcher(buildParams({ page: 1, limit: 9999 }));
        const exportCols = cols.filter(c => !c.skipExport);
        const columns = exportCols.map(c => c.label);
        const tableRows = res.data.map(row =>
          exportCols.map(c => c.exportValue ? c.exportValue(row) : String(row[c.key] ?? '-'))
        );
        downloadCSV(`${filename}.csv`, columns, tableRows);
      }
    } catch (err: any) {
      toast.error('ออกรายงานไม่สำเร็จ: ' + (err.message || ''));
    } finally { setExporting(null); }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!delTarget || !onDelete) return;
    setDeleting(true);
    try {
      await onDelete(delTarget);
      toast.success('ลบเรียบร้อย');
      setDelTarget(null);
      load();
    } catch (err: any) {
      toast.error(err.message || 'ลบไม่สำเร็จ');
    } finally { setDeleting(false); }
  };

  const totalPages = Math.ceil(total / limit);
  const showActions = !!actionCol || !!onDelete;

  // ── Filter controls rendered by DataTable ───────────────────────────────────
  const filterSearchKey = filters.find(f => f.type === 'search')?.key;

  if (isPrinting) {
    const { createPortal } = require('react-dom');
    const exportCols = cols.filter(c => !c.skipExport);
    const content = (
      <div className="print-only print-unbound bg-white text-black min-h-screen">
        <ReportPrintTemplate
          title={exportTitle ?? 'รายงาน'}
          columns={exportCols.map(c => ({
            label: c.label,
            key: c.key,
            render: c.exportValue ? (r: any) => c.exportValue!(r) : undefined
          }))}
          data={printData}
        />
      </div>
    );
    // Render directly into body to escape MainLayout overflow-hidden bounds
    return createPortal(content, document.body);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search input */}
          <div className="flex-1 min-w-44">
            <Input
              placeholder={filters.find(f => f.type === 'search')?.placeholder ?? searchPlaceholder}
              value={filterSearchKey ? filterValues[filterSearchKey] ?? search : search}
              onChange={e => {
                if (filterSearchKey) setFilter(filterSearchKey, e.target.value);
                else { setSearch(e.target.value); setPage(1); }
              }}
              icon={<Search size={13} />}
            />
          </div>

          {/* Select / Date filters */}
          {filters.filter(f => f.type !== 'search').map(f => (
            f.type === 'select' ? (
              <Select
                key={f.key}
                value={filterValues[f.key] ?? ''}
                onChange={e => setFilter(f.key, e.target.value)}
                options={[{ value: '', label: f.placeholder ?? 'ทั้งหมด' }, ...(f.options ?? [])]}
                className="min-w-[130px]"
              />
            ) : (
              <Input
                key={f.key}
                type="date"
                value={filterValues[f.key] ?? ''}
                onChange={e => setFilter(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-36"
              />
            )
          ))}

          {/* Extra filters (backward compat) */}
          {extraFilters}

          <button onClick={load}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary-600 transition-colors" title="รีเฟรช">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Client-side export buttons */}
          {exportTitle && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm"
                icon={<FileSpreadsheet size={13} />}
                loading={exporting === 'csv'}
                onClick={() => handleExport('csv')}>
                CSV
              </Button>
              <Button variant="secondary" size="sm"
                icon={<FileText size={13} />}
                loading={exporting === 'pdf'}
                onClick={() => handleExport('pdf')}>
                PDF
              </Button>
            </div>
          )}

          {onAdd && (
            <Button size="sm" icon={<Plus size={13} />} onClick={onAdd}>{addLabel}</Button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={28} /></div>
        ) : rows.length === 0 ? (
          <EmptyState icon={emptyIcon ?? <Filter size={36} />} title={emptyText} />
        ) : (
          <>
            <div className="overflow-x-auto overflow-y-auto max-h-[65vh]">
              <table className="w-full text-sm min-w-max">
                <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                  <tr>
                    {cols.map(c => (
                      <th key={c.key} style={c.width ? { width: c.width, minWidth: c.width } : {}}
                        className="px-4 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">
                        {c.label}
                      </th>
                    ))}
                    {showActions && (
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 whitespace-nowrap w-24">
                        จัดการ
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((row, i) => (
                    <tr key={i} className={`table-row-hover${onRowClick ? ' cursor-pointer' : ''}`}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}>
                      {cols.map(c => (
                        <td key={c.key} className={`px-4 py-3 ${c.className ?? ''}`}>
                          {c.render ? c.render(row) : (row[c.key] ?? '-')}
                        </td>
                      ))}
                      {showActions && (
                        <td className="px-4 py-3 text-right">
                          {actionCol ? actionCol(row) : (
                            <div className="flex items-center justify-end gap-1">
                              {onDelete && (
                                <button onClick={e => { e.stopPropagation(); setDelTarget(row); }}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" title="ลบ">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-white sticky bottom-0">
              <div className="flex items-center gap-3">
                <p className="text-xs text-slate-500">
                  {totalPages > 1 ? `หน้า ${page}/${totalPages} · ` : ''}{total.toLocaleString()} รายการ
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">แสดง</span>
                  <select
                    value={limit}
                    onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
                    className="h-6 px-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-primary-400 bg-white text-slate-600"
                  >
                    {PAGE_SIZE_OPTIONS.map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <span className="text-xs text-slate-400">รายการ</span>
                </div>
              </div>
              {totalPages > 1 && (
                <div className="flex gap-1">
                  <Button variant="secondary" size="xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>◀</Button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                    return start + i;
                  }).map(p => (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-primary-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                      {p}
                    </button>
                  ))}
                  <Button variant="secondary" size="xs" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>▶</Button>
                </div>
              )}
            </div>
          </>
        )}
      </Card>

      <p className="text-xs text-slate-400 text-right">ทั้งหมด {total.toLocaleString()} รายการ</p>

      <ConfirmDialog
        open={!!delTarget}
        title="ยืนยันการลบ"
        message={delTarget && deleteConfirmText ? deleteConfirmText(delTarget) : 'คุณแน่ใจหรือไม่ที่จะลบรายการนี้?'}
        confirmLabel={deleting ? 'กำลังลบ...' : 'ลบ'}
        onConfirm={handleDelete}
        onCancel={() => setDelTarget(null)}
      />
    </div>
  );
}
