'use client';
import { useState, useCallback, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import DetailDrawer from '@/components/DetailDrawer';
import PatientDrawer from '@/components/PatientDrawer';
import { CrudModal, FormGrid, FormSpan, RowActions } from '@/components/CrudModal';
import SearchSelect from '@/components/SearchSelect';
import { Badge, Button, ConfirmDialog } from '@/components/ui';
import { useConfirm } from '@/hooks/useConfirm';
import { queueApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Monitor, PhoneCall, CheckCircle2, XCircle, Clock, PackageCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const STATUS_MAP: Record<string, { label: string; variant: 'warning' | 'info' | 'success' | 'gray' }> = {
  waiting:   { label: 'รอเรียก',    variant: 'warning' },
  called:    { label: 'กำลังเรียก', variant: 'info' },
  completed: { label: 'เสร็จแล้ว',  variant: 'success' },
  skipped:   { label: 'ข้าม',       variant: 'gray' },
};

export default function QueuePage() {
  const { user } = useAuth();
  const { confirm: confirmDialog, dialogProps: confirmDialogProps } = useConfirm();
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // Stats
  const [stats, setStats] = useState<{ waiting: number; called: number; completed: number; skipped: number } | null>(null);
  const loadStats = useCallback(() => {
    queueApi.getStats().then(r => setStats(r.data)).catch(() => {});
  }, []);
  useEffect(() => {
    loadStats();
    const t = setInterval(() => { loadStats(); refresh(); }, 10000);
    return () => clearInterval(t);
  }, [loadStats, refreshKey]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [patientId, setPatientId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [modalKey, setModalKey] = useState(0);

  const openModal = () => {
    setPatientId(null);
    setNote('');
    setModalKey(k => k + 1);
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await queueApi.create({ patient_id: patientId ?? undefined, note: note || undefined });
      toast.success('เพิ่มคิวสำเร็จ');
      setModalOpen(false);
      refresh();
      loadStats();
    } catch (e: any) {
      toast.error(e.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [patientDrawerId, setPatientDrawerId] = useState<number | null>(null);

  const handleRowClick = (row: any) => {
    setSelected(row);
    setDrawerOpen(true);
  };

  // Actions
  const handleCall = async (row: any) => {
    try {
      await queueApi.call(row.queue_id, user?.id);
      toast.success(`เรียกคิว ${row.queue_number} แล้ว`);
      refresh();
      loadStats();
    } catch (e: any) {
      toast.error(e.message || 'เกิดข้อผิดพลาด');
    }
  };

  const handleComplete = async (row: any) => {
    try {
      await queueApi.complete(row.queue_id);
      toast.success(`คิว ${row.queue_number} เสร็จสิ้น`);
      refresh();
      loadStats();
      if (selected?.queue_id === row.queue_id) setDrawerOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'เกิดข้อผิดพลาด');
    }
  };

  const handleReceive = async (row: any) => {
    try {
      await queueApi.receive(row.queue_id, user?.email);
      toast.success(`✅ คิว ${row.queue_number} — ยืนยันรับยาเรียบร้อย`);
      refresh();
      loadStats();
      if (selected?.queue_id === row.queue_id) setDrawerOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'เกิดข้อผิดพลาด');
    }
  };

  const handleSkip = async (row: any) => {
    try {
      await queueApi.skip(row.queue_id);
      toast.success(`ข้ามคิว ${row.queue_number} แล้ว`);
      refresh();
      loadStats();
      if (selected?.queue_id === row.queue_id) setDrawerOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'เกิดข้อผิดพลาด');
    }
  };

  const handleDelete = async (row: any) => {
    if (!await confirmDialog({ title: `ลบคิว ${row.queue_number}?`, confirmLabel: 'ลบ', variant: 'danger' })) return;
    try {
      await queueApi.remove(row.queue_id);
      toast.success('ลบคิวแล้ว');
      refresh();
      loadStats();
      if (selected?.queue_id === row.queue_id) setDrawerOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'ลบได้เฉพาะคิวที่กำลังรอ');
    }
  };

  const COLS: ColDef[] = [
    {
      key: 'queue_number',
      label: 'หมายเลขคิว',
      className: 'font-bold text-primary-700 text-lg font-mono',
    },
    {
      key: 'patient_name',
      label: 'ผู้ป่วย',
      render: r => (
        <div>
          <p className="font-medium text-slate-800">{r.patient_name || <span className="text-slate-400 text-xs">ไม่ระบุ</span>}</p>
          {r.hn_number && <p className="text-xs text-slate-400 font-mono">HN: {r.hn_number}</p>}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'สถานะ',
      render: r => {
        const s = STATUS_MAP[r.status] ?? { label: r.status, variant: 'secondary' as const };
        return <Badge variant={s.variant}>{s.label}</Badge>;
      },
    },
    {
      key: 'created_at',
      label: 'เวลารับคิว',
      render: r => <span className="text-xs text-slate-500">{new Date(r.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>,
    },
    {
      key: '_action',
      label: '',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          {row.status === 'waiting' && (
            <button
              onClick={(e) => { e.stopPropagation(); handleCall(row); }}
              disabled={row.can_call !== true}
              title={row.can_call !== true ? 'รอเภสัชกรจ่ายยาก่อน' : undefined}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-green-500 hover:bg-green-600 disabled:hover:bg-green-500 text-white"
            >
              <PhoneCall size={13} /> เรียก
            </button>
          )}
          {row.status === 'called' && (
            <button
              onClick={(e) => { e.stopPropagation(); handleReceive(row); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <PackageCheck size={13} /> ยืนยันรับยา
            </button>
          )}
          <RowActions
            onEdit={() => {}}
            onView={() => handleRowClick(row)}
            onDelete={row.status === 'waiting' ? () => handleDelete(row) : undefined}
            canDelete={row.status === 'waiting'}
          />
        </div>
      ),
    },
  ];

  const s = selected;

  return (
    <MainLayout
      title="คิวผู้ป่วย"
      subtitle="Queue Management"
      actions={
        <div className="flex items-center gap-2">
          <a
            href="/queue/display"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Monitor size={15} /> เปิดหน้าแสดงผล
          </a>
          <Button onClick={openModal} icon={<Clock size={15} />}>เพิ่มคิว</Button>
        </div>
      }
    >
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'รอเรียก',    value: stats?.waiting ?? '-',   color: 'text-amber-600',  bg: 'bg-amber-50' },
          { label: 'กำลังเรียก', value: stats?.called ?? '-',    color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'เสร็จแล้ว',  value: stats?.completed ?? '-', color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'ข้ามแล้ว',   value: stats?.skipped ?? '-',   color: 'text-slate-500',  bg: 'bg-slate-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-4 text-center`}>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <DataTable
        cols={COLS}
        fetcher={(_params) =>
          queueApi.getQueue().then(r => ({ data: r.data.data, total: r.data.total }))
        }
        emptyIcon={<Clock size={36} />}
        emptyText="ยังไม่มีคิววันนี้"
        deps={[refreshKey]}
        onRowClick={handleRowClick}
      />

      {/* Add Modal */}
      <CrudModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="คิว"
        onSave={handleSave}
        saving={saving}
        size="md"
      >
        <FormGrid cols={1}>
          <SearchSelect
            key={modalKey}
            type="patient"
            label="ผู้ป่วย (ไม่บังคับ)"
            onSelect={(id) => setPatientId(id as number | null)}
          />
          <FormSpan>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">หมายเหตุ</label>
            <textarea
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
              rows={3}
              placeholder="หมายเหตุ (ไม่บังคับ)"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </FormSpan>
        </FormGrid>
      </CrudModal>

      {/* Detail Drawer */}
      <DetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={s ? `คิว ${s.queue_number}` : 'รายละเอียดคิว'}
        subtitle={s ? STATUS_MAP[s.status]?.label : ''}
        width="md"
      >
        {s ? (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'หมายเลขคิว',  value: s.queue_number },
                { label: 'สถานะ',       value: <Badge variant={STATUS_MAP[s.status]?.variant ?? 'gray'}>{STATUS_MAP[s.status]?.label ?? s.status}</Badge> },
                { label: 'ผู้ป่วย',     value: s.patient_id
                    ? <button onClick={() => setPatientDrawerId(s.patient_id)} className="text-left hover:text-primary-600 transition-colors underline decoration-dotted font-medium">{s.patient_name || '-'}</button>
                    : (s.patient_name || '-') },
                { label: 'HN',          value: s.hn_number || '-' },
                { label: 'เวลารับคิว',  value: new Date(s.created_at).toLocaleTimeString('th-TH') },
                { label: 'เวลาเรียก',   value: s.called_at ? new Date(s.called_at).toLocaleTimeString('th-TH') : '-' },
                { label: 'เวลาเสร็จ',  value: s.completed_at ? new Date(s.completed_at).toLocaleTimeString('th-TH') : '-' },
                { label: 'เรียกโดย',   value: s.called_by_name || '-' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
                  <p className="text-slate-800 text-sm">{value}</p>
                </div>
              ))}
            </div>
            {s.note && (
              <div className="bg-slate-50 rounded-lg px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">หมายเหตุ</p>
                <p className="text-slate-800 text-sm">{s.note}</p>
              </div>
            )}

            {/* Actions */}
            {(s.status === 'waiting' || s.status === 'called') && (
              <div className="flex flex-col gap-2 pt-2">
                {s.status === 'called' && (
                  <Button
                    onClick={() => handleReceive(s)}
                    icon={<PackageCheck size={14} />}
                    className="w-full bg-emerald-500 hover:bg-emerald-600"
                  >
                    ยืนยันรับยาแล้ว
                  </Button>
                )}
                <div className="flex gap-2">
                  {s.status === 'waiting' && (
                    <Button onClick={() => handleCall(s)} icon={<PhoneCall size={14} />} className="flex-1">
                      เรียกคิว
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => handleComplete(s)}
                    icon={<CheckCircle2 size={14} />}
                    className="flex-1"
                  >
                    เสร็จสิ้น
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleSkip(s)}
                    icon={<XCircle size={14} />}
                    className="flex-1"
                  >
                    ข้าม
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-center py-12">
            <p className="text-sm text-slate-400">ไม่พบข้อมูล</p>
          </div>
        )}
      </DetailDrawer>

      <PatientDrawer
        patientId={patientDrawerId}
        open={!!patientDrawerId}
        onClose={() => setPatientDrawerId(null)}
      />
      <ConfirmDialog {...confirmDialogProps} />
    </MainLayout>
  );
}
