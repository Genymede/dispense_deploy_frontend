'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import DetailDrawer from '@/components/DetailDrawer';
import { Spinner, Badge } from '@/components/ui';
import { patientApi } from '@/lib/api';
import { Users } from 'lucide-react';

const TREATMENT_RIGHT_LABEL: Record<string, string> = {
  UC: 'บัตรทอง (UC)', SSO: 'ประกันสังคม', GOVT: 'สวัสดิการข้าราชการ',
  LGO: 'องค์กรปกครองส่วนท้องถิ่น', SELF: 'ชำระเองเต็ม', OTHER: 'อื่นๆ',
};
function treatmentRightLabel(right: string | null, note: string | null): string {
  if (!right) return '—';
  const label = TREATMENT_RIGHT_LABEL[right] ?? right;
  return right === 'OTHER' && note ? `${label}: ${note}` : label;
}

export default function PatientsPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [detail, setDetail] = useState<{ patient: any; allergies: any[]; adrs: any[] } | null>(null);

  const COLS: ColDef[] = [
    { key: 'hn_number',   label: 'HN', className: 'font-mono font-medium text-primary-700' },
    { key: 'full_name',   label: 'ชื่อ-สกุล', className: 'font-medium' },
    { key: 'national_id', label: 'เลขบัตร', className: 'font-mono text-xs text-slate-500' },
    { key: 'phone',       label: 'โทรศัพท์', className: 'text-xs text-slate-600', render: r => r.phone || <span className="text-slate-400">-</span> },
  ];

  const handleRowClick = async (row: any) => {
    setDrawerOpen(true);
    setDrawerLoading(true);
    setDetail(null);
    try {
      const res = await patientApi.getById(row.patient_id);
      setDetail(res.data);
    } catch {
      setDetail(null);
    } finally {
      setDrawerLoading(false);
    }
  };

  const severityVariant = (s: string) => {
    if (s === 'severe')   return 'danger' as const;
    if (s === 'moderate') return 'warning' as const;
    return 'info' as const;
  };

  const p = detail?.patient;

  return (
    <MainLayout title="ข้อมูลผู้ป่วย" subtitle="Patient Registry">
      <DataTable
        cols={COLS}
        fetcher={(params) =>
          patientApi.getAll(params).then((r) => ({
            data: r.data.data,
            total: r.data.total,
          }))
        }
        emptyIcon={<Users size={36} />}
        emptyText="ไม่พบข้อมูลผู้ป่วย"
        deps={[]}
        onRowClick={handleRowClick}
      />

      <DetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={p ? `${p.full_name}` : 'ข้อมูลผู้ป่วย'}
        subtitle={p ? `HN: ${p.hn_number}` : ''}
        width="lg"
      >
        {drawerLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : detail ? (
          <div className="space-y-6 p-6">
            {/* Section 1: ข้อมูลผู้ป่วย */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Users size={14} className="text-primary-500" />ข้อมูลผู้ป่วย
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: 'HN',        value: p.hn_number },
                  { label: 'ชื่อ-สกุล',  value: p.full_name },
                  { label: 'เลขบัตรประชาชน', value: p.national_id },
                  { label: 'โทรศัพท์',  value: p.phone },
                  { label: 'เพศ',       value: p.gender },
                  { label: 'วันเกิด',   value: p.birthdate ? new Date(p.birthdate).toLocaleDateString('th-TH') : null },
                  { label: 'กรุ๊ปเลือด', value: p.blood_group },
                  { label: 'สิทธิ์การรักษา', value: treatmentRightLabel(p.treatment_right, p.treatment_right_note) },
                  { label: 'ที่อยู่',   value: [p.address, p.sub_district, p.district, p.province, p.postal_code].filter(Boolean).join(' ') || null },
                ].map(({ label, value }) =>
                  value ? (
                    <div key={label} className="bg-slate-50 rounded-lg px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
                      <p className="text-slate-800 text-sm">{value}</p>
                    </div>
                  ) : null
                )}
              </div>
            </div>

            {/* Section 2: ประวัติการแพ้ยา */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                ประวัติการแพ้ยา
                {detail.allergies.length > 0 && (
                  <Badge variant="danger" className="ml-2">{detail.allergies.length}</Badge>
                )}
              </h3>
              {detail.allergies.length === 0 ? (
                <p className="text-xs text-slate-400 italic">ไม่มีประวัติการแพ้ยา</p>
              ) : (
                <div className="space-y-2">
                  {detail.allergies.map((a, i) => (
                    <div key={i} className="border border-slate-100 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-800">{a.med_name}</span>
                        <Badge variant={severityVariant(a.severity)}>{a.severity}</Badge>
                      </div>
                      <p className="text-xs text-slate-500">{a.symptoms}</p>
                      {a.med_generic_name && <p className="text-xs text-slate-400 mt-0.5">{a.med_generic_name}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 3: ประวัติ ADR */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                ประวัติ ADR
                {detail.adrs.length > 0 && (
                  <Badge variant="warning" className="ml-2">{detail.adrs.length}</Badge>
                )}
              </h3>
              {detail.adrs.length === 0 ? (
                <p className="text-xs text-slate-400 italic">ไม่มีประวัติ ADR</p>
              ) : (
                <div className="space-y-2">
                  {detail.adrs.map((a, i) => (
                    <div key={i} className="border border-slate-100 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-800">{a.med_name}</span>
                        {a.severity && <Badge variant={severityVariant(a.severity)}>{a.severity}</Badge>}
                      </div>
                      <p className="text-xs text-slate-600">{a.description}</p>
                      {a.symptoms && <p className="text-xs text-slate-400 mt-0.5">{a.symptoms}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-12">
            <p className="text-sm text-slate-400">ไม่พบข้อมูลผู้ป่วย</p>
          </div>
        )}
      </DetailDrawer>
    </MainLayout>
  );
}
