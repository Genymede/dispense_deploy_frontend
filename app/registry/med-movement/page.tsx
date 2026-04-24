'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef, DateRangeFilter } from '@/components/DataTable';
import DetailDrawer, { DrawerSection, DrawerGrid } from '@/components/DetailDrawer';
import { Badge, Select } from '@/components/ui';
import { stockApi, type StockTransaction } from '@/lib/api';
import { thaiToday, thaiDaysAgo, fmtDate as safeDate } from '@/lib/dateUtils';
import {
  Activity, ArrowUpCircle, ArrowDownCircle,
  RotateCcw, AlertTriangle, Settings,
} from 'lucide-react';

const TX_CONFIG: Record<string, {
  label: string;
  icon: React.ReactNode;
  variant: 'success' | 'danger' | 'info' | 'warning' | 'gray';
}> = {
  in:      { label: 'รับเข้า',    icon: <ArrowDownCircle size={13} />, variant: 'success' },
  out:     { label: 'จ่ายออก',   icon: <ArrowUpCircle   size={13} />, variant: 'info'    },
  adjust:  { label: 'ปรับสต็อก', icon: <Settings        size={13} />, variant: 'warning' },
  return:  { label: 'คืนยา',     icon: <RotateCcw       size={13} />, variant: 'gray'    },
  expired: { label: 'หมดอายุ',   icon: <AlertTriangle   size={13} />, variant: 'danger'  },
};

const TX_TYPE_OPTIONS = [
  { value: '',        label: 'ทุกประเภท' },
  { value: 'in',      label: 'รับเข้า' },
  { value: 'out',     label: 'จ่ายออก' },
  { value: 'adjust',  label: 'ปรับสต็อก' },
  { value: 'return',  label: 'คืนยา' },
  { value: 'expired', label: 'หมดอายุ' },
];

const cols: ColDef[] = [
  { key: 'created_at', label: 'วันเวลา',
    render: r => <span className="text-xs text-slate-500 whitespace-nowrap">{safeDate(r.created_at, true)}</span>,
    exportValue: r => safeDate(r.created_at, true) },
  { key: 'tx_type', label: 'ประเภท',
    render: r => {
      const tc = TX_CONFIG[r.tx_type];
      if (!tc) return <span className="text-xs">{r.tx_type}</span>;
      return <Badge variant={tc.variant} className="gap-1.5">{tc.icon}{tc.label}</Badge>;
    },
    exportValue: r => TX_CONFIG[r.tx_type]?.label ?? r.tx_type },
  { key: 'med_name', label: 'ชื่อยา',
    render: r => (
      <>
        <p className="font-medium text-slate-800">{r.med_showname || r.med_name}</p>
        {r.med_generic_name && <p className="text-xs text-slate-400">{r.med_generic_name}</p>}
      </>
    ),
    exportValue: r => r.med_showname || r.med_name },
  { key: 'quantity', label: 'จำนวน',
    render: r => {
      const positive = r.tx_type === 'in' || r.tx_type === 'return';
      return (
        <span className={`font-semibold ${positive ? 'text-green-600' : 'text-red-600'}`}>
          {positive ? '+' : ''}{r.quantity.toLocaleString()}
        </span>
      );
    },
    exportValue: r => {
      const positive = r.tx_type === 'in' || r.tx_type === 'return';
      return (positive ? '+' : '') + r.quantity;
    } },
  { key: 'balance', label: 'ก่อน → หลัง',
    render: r => (
      <span className="text-xs font-mono text-slate-500">
        {r.balance_before.toLocaleString()}
        <span className="text-slate-300 mx-1">→</span>
        <span className="text-slate-700 font-semibold">{r.balance_after.toLocaleString()}</span>
      </span>
    ),
    exportValue: r => `${r.balance_before} → ${r.balance_after}` },
  { key: 'reference_no', label: 'เลขอ้างอิง',
    render: r => <span className="text-xs text-slate-500">{r.reference_no || r.prescription_no || r.ward_from || '—'}</span>,
    exportValue: r => r.reference_no || r.prescription_no || r.ward_from || '' },
  { key: 'performed_by_name', label: 'ผู้ดำเนินการ',
    render: r => <span className="text-xs text-slate-600">{r.performed_by_name || '—'}</span> },
  { key: 'note', label: 'หมายเหตุ',
    render: r => <span className="text-xs text-slate-400 max-w-[140px] truncate block">{r.note || '—'}</span> },
];

export default function MedMovementPage() {
  const [drawer,   setDrawer]   = useState<StockTransaction | null>(null);
  const [dateFrom, setDateFrom] = useState(thaiDaysAgo(30));
  const [dateTo,   setDateTo]   = useState(thaiToday());
  const [txType,   setTxType]   = useState('');

  const tc = drawer ? TX_CONFIG[drawer.tx_type] : null;
  const isPositive = drawer?.tx_type === 'in' || drawer?.tx_type === 'return';

  return (
    <MainLayout title="ทะเบียนการเคลื่อนไหวยา" subtitle="Medication Movement Registry">
      <DataTable
        cols={cols}
        fetcher={p =>
          stockApi.getTransactions({
            ...p,
            tx_type:   txType   || undefined,
            date_from: dateFrom,
            date_to:   dateTo,
          }).then(r => r.data)
        }
        searchPlaceholder="ค้นหาชื่อยา, เลขอ้างอิง..."
        emptyIcon={<Activity size={36} />}
        emptyText="ไม่พบรายการเคลื่อนไหว"
        exportTitle="ทะเบียนการเคลื่อนไหวยา"
        deps={[dateFrom, dateTo, txType]}
        onRowClick={setDrawer}
        extraFilters={
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              options={TX_TYPE_OPTIONS}
              value={txType}
              onChange={e => setTxType(e.target.value)}
              className="h-9 text-sm min-w-[130px]"
            />
            <DateRangeFilter
              dateFrom={dateFrom} dateTo={dateTo}
              onFromChange={setDateFrom} onToChange={setDateTo}
            />
          </div>
        }
      />

      <DetailDrawer
        open={!!drawer}
        onClose={() => setDrawer(null)}
        title={drawer ? (drawer.med_showname || drawer.med_name) : ''}
        subtitle={drawer ? safeDate(drawer.created_at, true) : ''}
      >
        {drawer && (
          <DrawerSection title="รายละเอียดการเคลื่อนไหว">
            <DrawerGrid items={[
              { label: 'ประเภท',
                value: tc
                  ? <Badge variant={tc.variant} className="gap-1.5">{tc.icon}{tc.label}</Badge>
                  : drawer.tx_type },
              { label: 'จำนวน',
                value: (
                  <span className={`font-bold text-base ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositive ? '+' : ''}{drawer.quantity.toLocaleString()}
                  </span>
                ) },
              { label: 'สต็อกก่อน',     value: drawer.balance_before.toLocaleString() },
              { label: 'สต็อกหลัง',     value: <span className="font-semibold">{drawer.balance_after.toLocaleString()}</span> },
              { label: 'ชื่อยา',
                value: (
                  <>
                    <p className="font-medium">{drawer.med_showname || drawer.med_name}</p>
                    {drawer.med_generic_name && <p className="text-xs text-slate-400">{drawer.med_generic_name}</p>}
                  </>
                ),
                span: true },
              { label: 'เลขอ้างอิง',    value: drawer.reference_no  || '—' },
              { label: 'เลขใบสั่งยา',   value: drawer.prescription_no || '—' },
              { label: 'Ward',            value: drawer.ward_from     || '—' },
              { label: 'Lot Number',      value: drawer.lot_number    || '—' },
              { label: 'วันหมดอายุ (lot)', value: safeDate(drawer.expiry_date) },
              { label: 'ผู้ดำเนินการ',   value: drawer.performed_by_name || '—' },
              { label: 'วันเวลา',        value: safeDate(drawer.created_at, true), span: true },
              { label: 'หมายเหตุ',       value: drawer.note || '—', span: true },
            ]} />
          </DrawerSection>
        )}
      </DetailDrawer>
    </MainLayout>
  );
}
