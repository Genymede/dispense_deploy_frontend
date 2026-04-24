'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef, ExportButtons } from '@/components/DataTable';
import { Badge, Button } from '@/components/ui';
import { api, extraReportApi } from '@/lib/api';
import RegistryDrawer from '@/components/RegistryDrawer';
import { CalendarClock, Play } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CutOffPage() {
  const [drawer, setDrawer] = useState<any | null>(null);
  const [executing, setExecuting] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleExecute = async (row: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const id = row.cut_off_period_id ?? row.id;
    if (!id) { toast.error('ไม่พบ ID ของรายการ'); return; }
    setExecuting(id);
    try {
      await api.post(`/reports/cut-off/${id}/execute`);
      toast.success('ดำเนินการตัดรอบเรียบร้อย');
      setRefreshKey(k => k + 1);
    } catch (err: any) {
      toast.error(err?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setExecuting(null);
    }
  };

  const COLS: ColDef[] = [
    { key: 'warehouse_name', label: 'คลังยา', className: 'font-medium' },
    { key: 'period_day', label: 'วัน', className: 'text-xs' },
    { key: 'period_month', label: 'เดือน', className: 'text-xs' },
    { key: 'period_time_h', label: 'เวลา', render: r => <span className="font-mono text-sm">{String(r.period_time_h??'0').padStart(2,'0')}:{String(r.period_time_m??'0').padStart(2,'0')}</span> },
    { key: 'is_active', label: 'สถานะ', render: r => <Badge variant={r.is_active?'success':'gray'}>{r.is_active?'ใช้งาน':'ไม่ใช้งาน'}</Badge> },
    { key: 'last_executed_at', label: 'ดำเนินการล่าสุด', className: 'text-xs', render: r => r.last_executed_at ? new Date(r.last_executed_at).toLocaleString('th-TH') : <span className="text-slate-400">-</span> },
    {
      key: 'actions', label: '', render: r => (
        <Button
          size="sm"
          variant="secondary"
          icon={<Play size={12} />}
          disabled={executing === (r.cut_off_period_id ?? r.id)}
          onClick={(e) => handleExecute(r, e)}
        >
          ดำเนินการตัดรอบ
        </Button>
      )
    },
  ];

  return (
    <MainLayout title="Cut-off Period" subtitle="Cut-off Period Report"
      actions={<ExportButtons report="inventory" />}>
      <DataTable cols={COLS}
        fetcher={p => extraReportApi.getCutOff(p).then((r: any) => ({ data: r.data.data ?? r.data, total: r.data.total ?? 0 }))}
        emptyIcon={<CalendarClock size={36} />} emptyText="ไม่พบรายการ"
        deps={[refreshKey]}
        onRowClick={row => setDrawer(row)}
      />
      <RegistryDrawer
        open={!!drawer} onClose={() => setDrawer(null)} row={drawer}
        title={r => r.warehouse_name || 'Cut-off'}
        subtitle={'ช่วงเวลา cut-off'}
        fields={[
          { label: 'คลังยา',  key: 'warehouse_name' },
          { label: 'วัน',     key: 'period_day', type: 'number' as const },
          { label: 'เดือน',   key: 'period_month', type: 'number' as const },
          { label: 'เวลา',    key: 'period_time_h', type: 'template' as const,
            template: r => `${String(r.period_time_h??'0').padStart(2,'0')}:${String(r.period_time_m??'0').padStart(2,'0')} น.` },
          { label: 'สถานะ',  key: 'is_active', type: 'boolean' as const },
        ]}
      />
    </MainLayout>
  );
}
