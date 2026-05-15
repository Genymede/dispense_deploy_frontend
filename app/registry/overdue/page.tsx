'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { Input, Badge, ConfirmDialog, Modal, Button } from '@/components/ui';
import SearchSelect from '@/components/SearchSelect';
import RegistryDrawer from '@/components/RegistryDrawer';
import { registryApi, crudApi } from '@/lib/api';
import { useConfirm } from '@/hooks/useConfirm';
import { Clock, Pill } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtDate } from '@/lib/dateUtils';

const cols: ColDef[] = [
  {
    key: 'med_name', label: 'ชื่อยา',
    render: r => <><p className="font-medium">{r.med_name}</p><p className="text-xs text-slate-400">{r.med_generic_name}</p></>
  },
  {
    key: 'patient_name', label: 'ผู้ป่วย',
    render: r => <><p className="font-medium">{r.patient_name || '-'}</p><p className="text-xs text-slate-400">{r.hn_number}</p></>
  },
  {
    key: 'quantity', label: 'จำนวน',
    render: r => <span className="font-semibold">{r.quantity} <span className="text-xs font-normal text-slate-400">{r.unit || ''}</span></span>
  },
  { key: 'doctor_name', label: 'แพทย์', className: 'text-xs' },
  {
    key: 'dispense_status', label: 'สถานะ',
    render: r => <Badge variant={r.dispense_status ? 'success' : 'warning'} dot>{r.dispense_status ? 'จ่ายแล้ว' : 'ค้างจ่าย'}</Badge>
  },
  {
    key: 'time', label: 'วันที่',
    render: r => fmtDate(r.time, true)
  },
];

const emptyDispenseForm = { med_sid: 0, drug_sub_label: '', quantity: '' };

export default function OverduePage() {
  const [reload, setReload] = useState(0);
  const [drawer, setDrawer] = useState<any | null>(null);
  const { confirm: alertDialog, dialogProps: alertDialogProps } = useConfirm();

  const [dispenseRow, setDispenseRow] = useState<any | null>(null);
  const [dispenseForm, setDispenseForm] = useState(emptyDispenseForm);
  const [dispenseResetKey, setDispenseResetKey] = useState(0);
  const [dispenseErrors, setDispenseErrors] = useState<Record<string, string>>({});
  const [dispensing, setDispensing] = useState(false);
  const df = (k: string, v: any) => setDispenseForm(p => ({ ...p, [k]: v }));

  const openDispenseModal = (row: any) => {
    setDispenseForm({
      med_sid: row.med_sid || 0,
      drug_sub_label: row.sub_drug_name || '',
      quantity: row.quantity ? String(row.quantity) : '',
    });
    setDispenseErrors({});
    setDispenseResetKey(k => k + 1);
    setDispenseRow(row);
  };

  const handleDispense = async () => {
    const errs: Record<string, string> = {};
    if (!dispenseForm.med_sid) errs.med_sid = 'กรุณาเลือกยาในคลัง';
    if (!dispenseForm.quantity || Number(dispenseForm.quantity) <= 0) errs.quantity = 'กรุณาระบุจำนวน';
    if (Object.keys(errs).length) { setDispenseErrors(errs); return; }
    setDispensing(true);
    try {
      await crudApi.updateOverdue(dispenseRow.overdue_id, {
        dispense_status: true,
        med_sid: dispenseForm.med_sid,
        quantity: Number(dispenseForm.quantity),
      });
      toast.success('จ่ายยาเรียบร้อย');
      setDispenseRow(null);
      setReload(r => r + 1);
    } catch (e: any) {
      await alertDialog({
        title: 'ไม่สามารถจ่ายยาได้',
        message: e.message,
        variant: 'warning',
        alertOnly: true,
      });
    } finally { setDispensing(false); }
  };

  return (
    <MainLayout title="ทะเบียนยาค้างจ่าย" subtitle="Overdue Medication Registry">
      <DataTable cols={cols}
        fetcher={p => registryApi.getOverdueMed(p).then(r => r.data)}
        searchPlaceholder="ค้นหาชื่อยา, ผู้ป่วย..."
        emptyIcon={<Clock size={36} />} emptyText="ไม่มียาค้างจ่าย 🎉"
        deps={[reload]}
        onRowClick={row => setDrawer(row)}
        actionCol={row => !row.dispense_status ? (
          <div className="flex items-center justify-end" onClick={e => e.stopPropagation()}>
            <button onClick={() => openDispenseModal(row)}
              className="px-2 py-1 rounded text-xs bg-green-50 text-green-700 hover:bg-green-100 font-medium">
              จ่ายยา
            </button>
          </div>
        ) : null}
      />

      <ConfirmDialog {...alertDialogProps} />

      {/* Dispense Modal */}
      <Modal open={!!dispenseRow} onClose={() => setDispenseRow(null)}
        title="จ่ายยาค้างจ่าย" size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDispenseRow(null)}>ยกเลิก</Button>
            <Button variant="primary" onClick={handleDispense} loading={dispensing} icon={<Pill size={14} />}>
              ยืนยันจ่ายยา
            </Button>
          </div>
        }
      >
        {dispenseRow && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl bg-slate-50 px-4 py-3 border border-slate-100">
              <p className="text-sm font-semibold text-slate-700">{dispenseRow.med_name}</p>
              {dispenseRow.med_generic_name && <p className="text-xs text-slate-400 mt-0.5">{dispenseRow.med_generic_name}</p>}
              {dispenseRow.patient_name && (
                <p className="text-xs text-slate-500 mt-1">ผู้ป่วย: {dispenseRow.patient_name} {dispenseRow.hn_number ? `(HN: ${dispenseRow.hn_number})` : ''}</p>
              )}
            </div>
            <div>
              <SearchSelect type="subwarehouse" label="ยาในคลัง" required
                initialDisplay={dispenseForm.drug_sub_label}
                resetKey={dispenseResetKey}
                onSelect={s => {
                  df('med_sid', s?.med_sid ?? 0);
                  df('drug_sub_label', s ? (s.med_showname || s.med_name) : '');
                  if (dispenseErrors.med_sid) setDispenseErrors(p => ({ ...p, med_sid: '' }));
                }} />
              {dispenseErrors.med_sid && <p className="mt-1 text-xs text-red-500">{dispenseErrors.med_sid}</p>}
            </div>
            <Input label="จำนวน" required type="number" min="1"
              value={dispenseForm.quantity}
              onChange={e => { df('quantity', e.target.value); if (dispenseErrors.quantity) setDispenseErrors(p => ({ ...p, quantity: '' })); }}
              error={dispenseErrors.quantity} />
          </div>
        )}
      </Modal>

      <RegistryDrawer
        open={!!drawer} onClose={() => setDrawer(null)} row={drawer}
        title="ยาค้างจ่าย" subtitle={r => r.med_name}
        fields={[
          { label: 'ชื่อยา', key: 'med_name' },
          { label: 'ผู้ป่วย', key: '_patient', type: 'patient' },
          { label: 'จำนวน', key: 'quantity', type: 'template', template: r => r.unit ? `${r.quantity} ${r.unit}` : String(r.quantity ?? '-') },
          { label: 'แพทย์', key: 'doctor_name' },
          { label: 'สถานะ', key: 'dispense_status', type: 'template', template: r => r.dispense_status ? 'จ่ายแล้ว' : 'ค้างจ่าย' },
          { label: 'วันที่', key: 'time', type: 'datetime' },
        ]}
      />
    </MainLayout>
  );
}
