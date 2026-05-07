'use client';
import { useEffect, useState } from 'react';
import DetailDrawer, { DrawerSection, DrawerGrid } from './DetailDrawer';
import { Badge, Spinner } from './ui';
import { patientApi, dispenseApi } from '@/lib/api';
import { parseISO, isValid, differenceInYears } from 'date-fns';
import { fmtDate } from '@/lib/dateUtils';
import { ShieldAlert, FlaskConical, ClipboardList } from 'lucide-react';

const safeDate = (val: any, withTime = false) => fmtDate(val, withTime);

const TREATMENT_RIGHT_LABEL: Record<string, string> = {
  UC: 'บัตรทอง (UC)', SSO: 'ประกันสังคม', GOVT: 'สวัสดิการข้าราชการ',
  LGO: 'องค์กรปกครองส่วนท้องถิ่น', SELF: 'ชำระเองเต็ม', OTHER: 'อื่นๆ',
};

const genderMap: Record<string, string> = { M: 'ชาย', F: 'หญิง' };

function treatmentRightLabel(right: string | null, note: string | null): string {
  if (!right) return '—';
  const label = TREATMENT_RIGHT_LABEL[right] ?? right;
  return right === 'OTHER' && note ? `${label}: ${note}` : label;
}

function calcAge(val: any): string {
  if (!val) return '—';
  try {
    const d = parseISO(String(val));
    if (!isValid(d)) return '—';
    return `${differenceInYears(new Date(), d)} ปี`;
  } catch { return '—'; }
}

interface Props {
  patientId: number | null;
  open: boolean;
  onClose: () => void;
}

export default function PatientDrawer({ patientId, open, onClose }: Props) {
  const [patient, setPatient] = useState<any | null>(null);
  const [allergies, setAllergies] = useState<any[]>([]);
  const [adrs, setAdrs] = useState<any[]>([]);
  const [rxs, setRxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !patientId) { setPatient(null); setAllergies([]); setAdrs([]); setRxs([]); return; }
    setLoading(true);
    Promise.all([
      patientApi.getById(patientId),
      dispenseApi.getAll({ patient_id: patientId, limit: 5 } as any),
    ]).then(([p, rx]) => {
      setPatient(p.data.patient);
      setAllergies(p.data.allergies ?? []);
      setAdrs(p.data.adrs ?? []);
      setRxs(rx.data.data ?? []);
    }).catch(() => { }).finally(() => setLoading(false));
  }, [open, patientId]);

  const title = patient ? `${patient.first_name} ${patient.last_name}` : 'ข้อมูลผู้ป่วย';
  const subtitle = patient ? `HN: ${patient.hn_number}` : '';

  return (
    <DetailDrawer open={open} onClose={onClose} title={title} subtitle={subtitle} width="lg">
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : !patient ? (
        <p className="text-sm text-slate-400 py-8 text-center">ไม่พบข้อมูลผู้ป่วย</p>
      ) : (
        <div className="flex gap-6 min-h-0">

          {/* ── ซ้าย: รูป + ข้อมูลพื้นฐาน ── */}
          <div className="w-[52%] flex-shrink-0 space-y-4">
            {/* รูป + ชื่อ */}
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <img
                src={`/images/patient_image/${patient.photo || 'user.png'}`}
                alt={`${patient.first_name} ${patient.last_name}`}
                onError={(e) => { (e.target as HTMLImageElement).src = '/images/patient_image/user.png'; }}
                className="w-16 h-16 rounded-full object-cover border-2 border-slate-200 shadow-sm flex-shrink-0"
              />
              <div>
                <p className="text-base font-semibold text-slate-800">{patient.first_name} {patient.last_name}</p>
                <p className="text-sm text-slate-500">HN: {patient.hn_number}</p>
                {patient.blood_group && <p className="text-xs text-slate-400 mt-0.5">🩸 {patient.blood_group}</p>}
              </div>
            </div>

            {/* ข้อมูลผู้ป่วย */}
            <DrawerSection title="ข้อมูลผู้ป่วย">
              <DrawerGrid items={[
                {
                  label: 'เพศ', value: (() => {
                    const val = patient.gender || patient.sex;
                    if (!val) return '—';
                    const g = String(val).toUpperCase();
                    return genderMap[g] ?? val;
                  })()
                },
                { label: 'วันเกิด', value: safeDate(patient.birthday) },
                { label: 'อายุ', value: patient.age_y != null ? `${patient.age_y} ปี ${patient.age_m ?? 0} เดือน` : calcAge(patient.birthday) },
                { label: 'เลขบัตรประชาชน', value: patient.national_id ?? '—' },
                { label: 'เบอร์โทร', value: patient.phone ?? '—' },
                { label: 'สิทธิ์การรักษา', value: treatmentRightLabel(patient.treatment_right, patient.treatment_right_note) },
                {
                  label: 'ที่อยู่', span: true, value: (() => {
                    const parts = [
                      patient.house_number ?? null,
                      patient.village_number ? `หมู่ ${patient.village_number}` : null,
                      patient.road ? `ถนน${patient.road}` : null,
                      patient.sub_district ? `ต.${patient.sub_district}` : null,
                      patient.district ? `อ.${patient.district}` : null,
                      patient.province ? `จ.${patient.province}` : null,
                      patient.postal_code ?? null,
                    ].filter(Boolean);
                    return parts.length > 0 ? parts.join(' ') : '—';
                  })()
                },
                { label: 'บันทึก (PMH)', value: patient.PMH ?? '—', span: true },
              ]} />
            </DrawerSection>
          </div>

          {/* ── ขวา: allergy + ADR + ใบสั่งยา ── */}
          <div className="flex-1 min-w-0 space-y-4 border-l border-slate-100 pl-6 overflow-y-auto">

            {/* ประวัติแพ้ยา */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert size={14} className="text-red-500" />
                <span className="text-sm font-semibold text-slate-700">ประวัติแพ้ยา</span>
                {allergies.length > 0 && <Badge variant="danger">{allergies.length} รายการ</Badge>}
              </div>
              {allergies.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">ไม่มีประวัติแพ้ยา</p>
              ) : (
                <div className="space-y-1.5">
                  {allergies.map((a, i) => (
                    <div key={i} className="px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-800">{a.med_name}</span>
                        <Badge variant={a.severity === 'severe' ? 'danger' : a.severity === 'moderate' ? 'warning' : 'gray'}>
                          {a.severity || '—'}
                        </Badge>
                      </div>
                      {a.symptoms && <p className="text-slate-500 mt-0.5">อาการ: {a.symptoms}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ADR */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FlaskConical size={14} className="text-amber-500" />
                <span className="text-sm font-semibold text-slate-700">ADR</span>
                {adrs.length > 0 && <Badge variant="warning">{adrs.length} รายการ</Badge>}
              </div>
              {adrs.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">ไม่มีประวัติ ADR</p>
              ) : (
                <div className="space-y-1.5">
                  {adrs.map((a, i) => (
                    <div key={i} className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-100 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-800">{a.med_name}</span>
                        <Badge variant={a.severity === 'severe' ? 'danger' : 'warning'}>{a.severity || '—'}</Badge>
                      </div>
                      {a.symptoms && <p className="text-slate-500 mt-0.5">อาการ: {a.symptoms}</p>}
                      {a.outcome && <p className="text-slate-400">ผลลัพธ์: {a.outcome}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ใบสั่งยาล่าสุด */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ClipboardList size={14} className="text-primary-500" />
                <span className="text-sm font-semibold text-slate-700">ใบสั่งยาล่าสุด</span>
              </div>
              {rxs.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">ไม่มีประวัติใบสั่งยา</p>
              ) : (
                <div className="space-y-1.5">
                  {rxs.map((rx, i) => (
                    <div key={i} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-medium text-slate-700">{rx.prescription_no}</span>
                        <Badge variant={rx.status === 'dispensed' ? 'success' : rx.status === 'pending' ? 'warning' : 'gray'}>
                          {rx.status}
                        </Badge>
                      </div>
                      <p className="text-slate-400 mt-0.5">{safeDate(rx.created_at)}{rx.ward ? ` · ${rx.ward}` : ''}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </DetailDrawer>
  );
}
