'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { extraReportApi, stockApi } from '@/lib/api';
import { Button } from '@/components/ui';
import { fmtDate } from '@/lib/dateUtils';
import RegistryDrawer from '@/components/RegistryDrawer';
import { TrendingDown, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MedExpiredPage() {
  const [drawer, setDrawer] = useState<any | null>(null);
  const [reload, setReload] = useState(0);
  const [writingOff, setWritingOff] = useState<number | null>(null);
  const [confirmRow, setConfirmRow] = useState<any | null>(null);

  const handleWriteOff = async (row: any) => {
    setWritingOff(row.med_sid);
    try {
      const res = await stockApi.writeOff({ med_sid: row.med_sid });
      toast.success(res.data.message);
      setDrawer(null);
      setConfirmRow(null);
      setReload(r => r + 1);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setWritingOff(null);
    }
  };

  const COLS: ColDef[] = [
    {
      key: 'drug_name', label: 'ชื่อยา',
      render: r => <><p className="font-medium">{r.drug_name}</p><p className="text-xs text-slate-400">{r.packaging_type}</p></>,
      exportValue: r => r.drug_name ?? '-',
    },
    { key: 'unit', label: 'หน่วย', className: 'text-xs' },
    { key: 'med_quantity', label: 'จำนวน', className: 'font-semibold text-red-600' },
    { key: 'location', label: 'ที่เก็บ', className: 'text-xs font-mono' },
    {
      key: 'exp_date', label: 'หมดอายุ',
      render: r => r.exp_date ? <span className="text-red-600 font-medium">{fmtDate(r.exp_date)}</span> : '-',
      exportValue: r => fmtDate(r.exp_date),
    },
    {
      key: '_action', label: '',
      render: r => (
        <Button
          variant="danger"
          size="xs"
          icon={<Trash2 size={12} />}
          loading={writingOff === r.med_sid}
          onClick={e => { e.stopPropagation(); setConfirmRow(r); }}
        >
          ตัดออก
        </Button>
      ),
    },
  ];

  return (
    <MainLayout title="ยาหมดอายุ" subtitle="Expired Medication Report">
      <DataTable
        cols={COLS}
        fetcher={p => extraReportApi.getMedExpired(p).then((r: any) => ({ data: r.data.data ?? r.data, total: r.data.total ?? 0 }))}
        filters={[{ key: 'search', type: 'search', placeholder: 'ค้นหาชื่อยา...' }]}
        exportTitle="ยาหมดอายุ"
        emptyIcon={<TrendingDown size={36} />} emptyText="ไม่พบรายการ"
        deps={[reload]} onRowClick={row => setDrawer(row)}
      />

      <RegistryDrawer
        open={!!drawer} onClose={() => setDrawer(null)} row={drawer}
        title={r => r.drug_name} subtitle="ยาหมดอายุ"
        fields={[
          { label: 'ชื่อยา',     key: 'drug_name' },
          { label: 'รูปแบบ',     key: 'packaging_type' },
          { label: 'จำนวน',      key: 'med_quantity', type: 'number' as const },
          { label: 'หน่วย',      key: 'unit' },
          { label: 'ที่เก็บ',    key: 'location' },
          { label: 'Lot',        key: 'lot_number' },
          { label: 'วันหมดอายุ', key: 'exp_date', type: 'date' as const },
        ]}
        extraActions={r => (
          <Button
            variant="danger"
            icon={<Trash2 size={14} />}
            loading={writingOff === r.med_sid}
            onClick={() => setConfirmRow(r)}
          >
            ตัดออก
          </Button>
        )}
      />

      {/* Confirm Dialog */}
      {confirmRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-3 text-red-600">
              <Trash2 size={22} />
              <h3 className="font-bold text-base text-slate-800">ยืนยันการตัดออก</h3>
            </div>
            <p className="text-sm text-slate-600 mb-1">
              ตัดล็อตยาหมดอายุทั้งหมดของ
            </p>
            <p className="font-semibold text-slate-800 mb-1">{confirmRow.drug_name}</p>
            <p className="text-sm text-slate-500 mb-5">
              จำนวน <span className="font-semibold text-red-600">{confirmRow.med_quantity} {confirmRow.unit}</span> ออกจากคลัง
              <br />
              <span className="text-xs">การกระทำนี้ไม่สามารถย้อนกลับได้</span>
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmRow(null)}
                className="px-4 py-2 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => handleWriteOff(confirmRow)}
                disabled={writingOff === confirmRow.med_sid}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {writingOff === confirmRow.med_sid ? 'กำลังตัดออก...' : 'ยืนยันตัดออก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
