'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef, StatusBadge, DateRangeFilter } from '@/components/DataTable';
import DetailDrawer, { DrawerSection, DrawerGrid } from '@/components/DetailDrawer';
import { Badge, Spinner } from '@/components/ui';
import { registryApi, dispenseApi } from '@/lib/api';
import { thaiToday, thaiDaysAgo, fmtDate as safeDate } from '@/lib/dateUtils';
import { ClipboardList, Eye, Pill } from 'lucide-react';

const STATUS_MAP = {
  pending:   { label: 'รอจ่าย',   variant: 'warning' as const },
  dispensed: { label: 'จ่ายแล้ว', variant: 'success' as const },
  returned:  { label: 'คืนยา',    variant: 'gray'    as const },
  cancelled: { label: 'ยกเลิก',   variant: 'danger'  as const },
};

const cols: ColDef[] = [
  { key: 'prescription_no', label: 'เลขใบสั่ง',
    render: r => <span className="font-mono text-xs text-primary-700">{r.prescription_no}</span> },
  { key: 'patient_name', label: 'ผู้ป่วย',
    render: r => <><p className="font-medium">{r.patient_name || 'ไม่ระบุ'}</p><p className="text-xs text-slate-400">{r.hn_number}</p></> },
  { key: 'ward',              label: 'วอร์ด',   className: 'text-xs text-slate-600' },
  { key: 'doctor_name',       label: 'แพทย์',   className: 'text-xs text-slate-600' },
  { key: 'status',            label: 'สถานะ',
    render: r => <StatusBadge status={r.status} map={STATUS_MAP} /> },
  { key: 'item_count',        label: 'รายการ',
    render: r => <span className="text-xs">{r.item_count} รายการ</span> },
  { key: 'total_cost', label: 'ยอดรวม',
    render: r => Number(r.total_cost) > 0
      ? <span className="text-sm font-medium text-slate-700">{Number(r.total_cost).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</span>
      : <span className="text-slate-300">—</span>,
    exportValue: r => Number(r.total_cost) > 0 ? `${Number(r.total_cost).toFixed(2)}` : '-' },
  { key: 'dispensed_by_name', label: 'ผู้จ่าย', className: 'text-xs text-slate-500' },
  { key: 'dispensed_at',      label: 'เวลาจ่าย',
    render: r => safeDate(r.dispensed_at, true),
    exportValue: r => safeDate(r.dispensed_at, true) },
];


export default function DispenseHistoryPage() {
  const [drawer,      setDrawer]      = useState<any | null>(null);
  const [drawerFull,  setDrawerFull]  = useState<any | null>(null);
  const [loadingFull, setLoadingFull] = useState(false);
  const [dateFrom, setDateFrom] = useState(thaiDaysAgo(30));
  const [dateTo,   setDateTo]   = useState(thaiToday());

  const openDrawer = async (row: any) => {
    setDrawer(row);
    setDrawerFull(null);
    setLoadingFull(true);
    try {
      const res = await dispenseApi.getFull(row.prescription_id);
      setDrawerFull(res.data);
    } catch {
      setDrawerFull(null);
    } finally {
      setLoadingFull(false);
    }
  };

  const statusCfg = drawer ? (STATUS_MAP[drawer.status as keyof typeof STATUS_MAP] ?? { label: drawer.status, variant: 'gray' as const }) : null;

  return (
    <MainLayout title="ประวัติจ่ายยา" subtitle="Dispensing History">
      <DataTable cols={cols}
        fetcher={p => registryApi.getDispenseHistory({ ...p, date_from: dateFrom, date_to: dateTo }).then(r => r.data)}
        searchPlaceholder="ค้นหาเลขใบสั่ง, ผู้ป่วย, HN..."
        emptyIcon={<ClipboardList size={36} />} emptyText="ไม่พบประวัติ"
        deps={[dateFrom, dateTo]}
        onRowClick={openDrawer}
        actionCol={row => (
          <button onClick={() => openDrawer(row)}
            className="p-1.5 rounded-lg hover:bg-primary-50 text-slate-400 hover:text-primary-600 transition-colors" title="ดูรายละเอียด">
            <Eye size={14} />
          </button>
        )}
        extraFilters={
          <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo}
            onFromChange={setDateFrom} onToChange={setDateTo} />
        }
      />

      <DetailDrawer
        open={!!drawer} onClose={() => { setDrawer(null); setDrawerFull(null); }}
        title={drawer ? `ใบสั่งยา ${drawer.prescription_no}` : ''}
        subtitle={drawer ? `${drawer.patient_name || 'ไม่ระบุ'} · HN: ${drawer.hn_number || '—'}` : ''}
        width="lg"
      >
        {drawer && (
          <>
            {/* ข้อมูลใบสั่งยา */}
            <DrawerSection title="ข้อมูลใบสั่งยา">
              <DrawerGrid items={[
                { label: 'เลขใบสั่ง',   value: <span className="font-mono text-primary-700">{drawer.prescription_no}</span> },
                { label: 'สถานะ',       value: statusCfg ? <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge> : drawer.status },
                { label: 'ผู้ป่วย',     value: <><p className="font-medium">{drawer.patient_name || 'ไม่ระบุ'}</p><p className="text-xs text-slate-400">HN: {drawer.hn_number || '—'}</p></> },
                { label: 'วอร์ด',       value: drawer.ward || '—' },
                { label: 'แพทย์',       value: drawer.doctor_name || '—' },
                { label: 'ผู้จ่ายยา',   value: drawer.dispensed_by_name || '—' },
                { label: 'วันที่สร้าง', value: safeDate(drawer.created_at, true), span: true },
                { label: 'จ่ายเมื่อ',   value: safeDate(drawer.dispensed_at, true) },
                { label: 'ยอดรวม',     value: Number(drawer.total_cost) > 0
                    ? `${Number(drawer.total_cost).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`
                    : '—' },
                { label: 'หมายเหตุ',    value: drawer.note || '—', span: true },
              ]} />
            </DrawerSection>

            {/* รายการยา */}
            <DrawerSection title={`รายการยา (${drawer.item_count ?? '?'} รายการ)`}>
              {loadingFull ? (
                <div className="flex justify-center py-6"><Spinner /></div>
              ) : drawerFull?.items?.length > 0 ? (
                <div className="space-y-2">
                  {drawerFull.items.map((item: any, i: number) => (
                    <div key={i} className="bg-slate-50 rounded-xl px-4 py-3 flex gap-3">
                      <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center">
                        <Pill size={14} className="text-primary-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 leading-snug">
                          {item.med_showname || item.med_name}
                        </p>
                        {item.med_name !== (item.med_showname || item.med_name) && (
                          <p className="text-xs text-slate-400">{item.med_name}</p>
                        )}
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                          <span className="text-xs text-slate-600">จำนวน: <span className="font-semibold">{item.quantity} {item.unit || ''}</span></span>
                          {item.dose      && <span className="text-xs text-slate-500">ขนาด: {item.dose}</span>}
                          {item.frequency && <span className="text-xs text-slate-500">ความถี่: {item.frequency}</span>}
                          {item.route     && <span className="text-xs text-slate-500">วิธีใช้: {item.route}</span>}
                          {item.unit_price > 0 && (
                            <span className="text-xs text-primary-600 font-medium">
                              {Number(item.unit_price).toFixed(2)} × {item.quantity} = {Number(item.line_total ?? item.unit_price * item.quantity).toFixed(2)} บาท
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !loadingFull ? (
                <p className="text-sm text-slate-400 text-center py-4">ไม่พบรายการยา</p>
              ) : null}
            </DrawerSection>
          </>
        )}
      </DetailDrawer>
    </MainLayout>
  );
}
