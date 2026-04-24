'use client';
import { useState, useCallback, useEffect, useMemo } from 'react';
import Image from 'next/image';
import MainLayout from '@/components/MainLayout';
import { Badge, Spinner, Modal, Card, Input, Button } from '@/components/ui';
import { dispenseApi, patientApi } from '@/lib/api';
import {
  ClipboardList, RefreshCw, Search, ChevronRight, ChevronLeft,
  Pill, X, ShieldAlert, FlaskConical, Phone, MapPin, Droplets,
  Calendar, FileText, User2, Stethoscope, ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { parseISO, differenceInYears, isValid } from 'date-fns';
import { fmtDate as safeDate } from '@/lib/dateUtils';

function safeAge(val: any): number | null {
  if (!val) return null;
  try { const d = parseISO(String(val)); return isValid(d) ? differenceInYears(new Date(), d) : null; }
  catch { return null; }
}

const TREATMENT_RIGHT_LABEL: Record<string, string> = {
  UC: 'บัตรทอง (UC)', SSO: 'ประกันสังคม', GOVT: 'สวัสดิการข้าราชการ',
  LGO: 'องค์กรปกครองส่วนท้องถิ่น', SELF: 'ชำระเองเต็ม', OTHER: 'อื่นๆ',
};
function treatmentRightLabel(right: string | null, note: string | null): string {
  if (!right) return '—';
  const label = TREATMENT_RIGHT_LABEL[right] ?? right;
  return right === 'OTHER' && note ? `${label}: ${note}` : label;
}

const AVATAR_COLORS = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#ef4444'];
function avatarColor(name: string) {
  return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

const RX_STATUS: Record<string, { label: string; variant: 'success' | 'warning' | 'gray' | 'danger'; dot: string }> = {
  dispensed: { label: 'จ่ายแล้ว', variant: 'success', dot: 'bg-emerald-400' },
  pending:   { label: 'รอจ่าย',   variant: 'warning', dot: 'bg-amber-400'  },
  returned:  { label: 'คืนยา',    variant: 'gray',    dot: 'bg-slate-400'  },
  cancelled: { label: 'ยกเลิก',   variant: 'danger',  dot: 'bg-red-400'   },
};

export default function MedUsagePage() {
  const [view, setView] = useState<'list' | 'detail'>('list');

  const [patients,       setPatients]       = useState<any[]>([]);
  const [patientLoading, setPatientLoading] = useState(false);
  const [searchText,     setSearchText]     = useState('');
  const [listPage,       setListPage]       = useState(1);
  const [listPerPage,    setListPerPage]    = useState(20);
  const PAGE_SIZE_OPTIONS = [5, 10, 20, 40, 100];

  const [patient,   setPatient]   = useState<any>(null);
  const [allergies, setAllergies] = useState<any[]>([]);
  const [adrs,      setAdrs]      = useState<any[]>([]);

  const [rxList,    setRxList]    = useState<any[]>([]);
  const [rxLoading, setRxLoading] = useState(false);

  const [rxDetail,        setRxDetail]        = useState<any>(null);
  const [rxDetailLoading, setRxDetailLoading] = useState(false);
  const [showRxModal,     setShowRxModal]     = useState(false);

  const loadPatients = useCallback(async () => {
    setPatientLoading(true);
    try {
      const res = await patientApi.getAll({ limit: 500 });
      setPatients(res.data.data);
    } catch { toast.error('โหลดรายชื่อผู้ป่วยไม่สำเร็จ'); }
    finally { setPatientLoading(false); }
  }, []);

  useEffect(() => { loadPatients(); }, [loadPatients]);

  const loadDetail = useCallback(async (p: any) => {
    setPatient(p); setAllergies([]); setAdrs([]); setView('detail'); setRxLoading(true);
    try {
      const [rxRes, ptRes] = await Promise.all([
        dispenseApi.getAll({ patient_id: p.patient_id, limit: 100 } as any),
        patientApi.getById(p.patient_id),
      ]);
      setRxList(rxRes.data.data);
      setPatient(ptRes.data.patient);
      setAllergies(ptRes.data.allergies ?? []);
      setAdrs(ptRes.data.adrs ?? []);
    } catch { toast.error('โหลดข้อมูลไม่สำเร็จ'); }
    finally { setRxLoading(false); }
  }, []);

  const openRxDetail = async (rx: any) => {
    setRxDetail(null); setShowRxModal(true); setRxDetailLoading(true);
    try {
      const res = await dispenseApi.getById(rx.prescription_id);
      setRxDetail(res.data);
    } catch { toast.error('โหลดรายละเอียดไม่สำเร็จ'); setShowRxModal(false); }
    finally { setRxDetailLoading(false); }
  };

  const filteredPatients = useMemo(() => {
    setListPage(1);
    const q = searchText.toLowerCase().trim();
    if (!q) return patients;
    return patients.filter(p =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
      (p.hn_number ?? '').toLowerCase().includes(q) ||
      (p.national_id ?? '').includes(q)
    );
  }, [patients, searchText]);

  const totalListPages = Math.ceil(filteredPatients.length / listPerPage);
  const pagedPatients  = filteredPatients.slice((listPage - 1) * listPerPage, listPage * listPerPage);

  return (
    <MainLayout title="Med Reconciliation" subtitle="ประวัติการใช้ยาผู้ป่วย">

      {/* ═══════════════ LIST VIEW ═══════════════ */}
      {view === 'list' ? (
        <div className="space-y-4">

          {/* Toolbar — เหมือน DataTable */}
          <Card>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-44">
                <Input
                  autoFocus
                  placeholder="ค้นหาชื่อผู้ป่วย, HN, เลขบัตรประชาชน..."
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  icon={<Search size={13} />}
                />
              </div>
              <button onClick={loadPatients}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary-600 transition-colors" title="รีเฟรช">
                <RefreshCw size={14} className={patientLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </Card>

          {patientLoading ? (
            <div className="flex justify-center py-20"><Spinner size={28} /></div>
          ) : filteredPatients.length === 0 ? (
            <Card className="py-20 text-center">
              <User2 size={32} className="text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">{searchText ? 'ไม่พบผู้ป่วยที่ตรงกับการค้นหา' : 'ไม่มีข้อมูลผู้ป่วย'}</p>
            </Card>
          ) : (
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto overflow-y-auto max-h-[65vh]">
                <table className="w-full text-sm min-w-max">
                  <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap w-10">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">ชื่อ-นามสกุล</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">HN</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">อายุ</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">หมู่เลือด</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">เบอร์โทร</th>
                      <th className="px-4 py-3 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {pagedPatients.map((p, idx) => {
                      const color = avatarColor(p.first_name ?? '');
                      const age = p.age_y ?? safeAge(p.birthday);
                      const globalIdx = (listPage - 1) * listPerPage + idx + 1;
                      return (
                        <tr key={p.patient_id} onClick={() => loadDetail(p)}
                          className="table-row-hover cursor-pointer group">
                          <td className="px-4 py-3 text-xs text-slate-300 tabular-nums">{globalIdx}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              {p.patient_photo ? (
                                <Image src={`/images/patient_image/${p.patient_photo}`} alt="" width={32} height={32}
                                  className="w-8 h-8 rounded-full object-cover border border-slate-100 shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold"
                                  style={{ background: color }}>
                                  {p.first_name?.[0] ?? '?'}
                                </div>
                              )}
                              <span className="font-medium text-slate-800 group-hover:text-primary-700 transition-colors">
                                {p.first_name} {p.last_name}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 font-mono">{p.hn_number ?? '—'}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{age != null ? `${age} ปี` : '—'}</td>
                          <td className="px-4 py-3">
                            {p.blood_group
                              ? <span className="text-[10px] font-bold px-2 py-0.5 bg-red-50 text-red-500 border border-red-100 rounded-full">{p.blood_group}</span>
                              : <span className="text-xs text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{p.phone ?? '—'}</td>
                          <td className="px-4 py-3">
                            <ChevronRight size={14} className="text-slate-300 group-hover:text-primary-400 transition-colors" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-white sticky bottom-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-slate-500">
                    หน้า {listPage}/{totalListPages} · {filteredPatients.length.toLocaleString()} รายการ
                  </p>
                  <select
                    value={listPerPage}
                    onChange={e => { setListPerPage(Number(e.target.value)); setListPage(1); }}
                    className="h-6 px-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-primary-400 bg-white text-slate-600"
                  >
                    {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <span className="text-xs text-slate-400">/ หน้า</span>
                </div>
                {totalListPages > 1 && (
                  <div className="flex gap-1">
                    <Button variant="secondary" size="xs" disabled={listPage === 1} onClick={() => setListPage(p => p - 1)}>◀</Button>
                    {Array.from({ length: Math.min(5, totalListPages) }, (_, i) => {
                      const start = Math.max(1, Math.min(listPage - 2, totalListPages - 4));
                      return start + i;
                    }).map(p => (
                      <button key={p} onClick={() => setListPage(p)}
                        className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${p === listPage ? 'bg-primary-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                        {p}
                      </button>
                    ))}
                    <Button variant="secondary" size="xs" disabled={listPage >= totalListPages} onClick={() => setListPage(p => p + 1)}>▶</Button>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

      ) : (
      /* ═══════════════ DETAIL VIEW ═══════════════ */
        <>
          {/* breadcrumb */}
          <div className="flex items-center gap-2 mb-5">
            <button
              onClick={() => { setView('list'); setPatient(null); setRxList([]); setAllergies([]); setAdrs([]); }}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-primary-600 transition-colors"
            >
              <ChevronLeft size={15} />
              <span>ผู้ป่วยทั้งหมด</span>
            </button>
            <ChevronRight size={13} className="text-slate-300" />
            <span className="text-sm font-semibold text-slate-800 truncate">{patient?.first_name} {patient?.last_name}</span>
            <button onClick={() => loadDetail(patient)} className="ml-auto p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors" title="รีเฟรช">
              <RefreshCw size={13} />
            </button>
          </div>

          <div className="flex gap-5 items-start">

            {/* ── LEFT: Patient card ── */}
            <div className="w-68 shrink-0 sticky top-4 space-y-3" style={{ width: '17rem' }}>

              {/* identity card */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                {/* blue banner */}
                <div className="px-4 pt-4 pb-10 relative"
                  style={{ background: 'linear-gradient(135deg, #0052a0, #003d7a)' }}>
                  <p className="text-[10px] font-semibold text-blue-200/70 uppercase tracking-widest">ข้อมูลผู้ป่วย</p>
                  <p className="text-white font-bold text-base leading-tight mt-0.5 truncate">{patient?.first_name} {patient?.last_name}</p>
                  <p className="text-blue-200/80 text-xs mt-0.5">HN: {patient?.hn_number ?? '—'}</p>
                  {patient?.national_id && <p className="text-blue-200/60 text-[10px] mt-0.5">{patient.national_id}</p>}
                </div>

                {/* avatar overlapping banner */}
                <div className="px-4 pb-4 -mt-8 relative">
                  <div className="flex items-end gap-3 mb-3">
                    {patient?.patient_photo ? (
                      <Image src={`/images/patient_image/${patient.patient_photo}`} alt="" width={56} height={56}
                        className="w-14 h-14 rounded-full object-cover border-3 border-white shadow-md shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-full border-4 border-white shadow-md flex items-center justify-center text-white font-bold text-xl shrink-0"
                        style={{ background: avatarColor(patient?.first_name ?? '') }}>
                        {patient?.first_name?.[0] ?? '?'}
                      </div>
                    )}
                    {patient?.blood_group && (
                      <span className="mb-1 text-xs font-bold px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded-full">
                        🩸 {patient.blood_group}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {patient?.birthday && (
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Calendar size={12} className="text-slate-400 shrink-0" />
                        <span>
                          {safeDate(patient.birthday)}
                          {(() => { const a = patient.age_y ?? safeAge(patient.birthday); return a != null ? ` · ${a} ปี` : ''; })()}
                        </span>
                      </div>
                    )}
                    {patient?.treatment_right && (
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Stethoscope size={12} className="text-slate-400 shrink-0" />
                        <span>{treatmentRightLabel(patient.treatment_right, patient.treatment_right_note)}</span>
                      </div>
                    )}
                    {patient?.phone && (
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Phone size={12} className="text-slate-400 shrink-0" />
                        <span>{patient.phone}</span>
                      </div>
                    )}
                    {(patient?.district || patient?.province) && (
                      <div className="flex items-start gap-2 text-xs text-slate-600">
                        <MapPin size={12} className="text-slate-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">
                          {[patient.sub_district && `ต.${patient.sub_district}`, patient.district && `อ.${patient.district}`, patient.province && `จ.${patient.province}`].filter(Boolean).join(' ')}
                        </span>
                      </div>
                    )}
                  </div>

                  {patient?.PMH && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">PMH</p>
                      <p className="text-xs text-slate-600 leading-relaxed">{patient.PMH}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* allergies */}
              <div className={`bg-white border rounded-xl p-4 ${allergies.length > 0 ? 'border-red-200' : 'border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-2.5">
                  <ShieldAlert size={13} className={allergies.length > 0 ? 'text-red-500' : 'text-slate-400'} />
                  <span className="text-xs font-semibold text-slate-700">ประวัติแพ้ยา</span>
                  {allergies.length > 0 && <Badge variant="danger">{allergies.length} รายการ</Badge>}
                </div>
                {allergies.length === 0 ? (
                  <p className="text-xs text-slate-400">ไม่มีประวัติแพ้ยา</p>
                ) : (
                  <div className="space-y-1.5">
                    {allergies.map((a, i) => (
                      <div key={i} className="px-2.5 py-1.5 bg-red-50 border border-red-100 rounded-lg text-xs">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-slate-800 truncate">{a.med_name}</span>
                          <Badge variant={a.severity === 'severe' ? 'danger' : 'warning'}>{a.severity || '—'}</Badge>
                        </div>
                        {a.symptoms && <p className="text-slate-500 mt-0.5">{a.symptoms}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ADR */}
              {adrs.length > 0 && (
                <div className="bg-white border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2.5">
                    <FlaskConical size={13} className="text-amber-500" />
                    <span className="text-xs font-semibold text-slate-700">ADR</span>
                    <Badge variant="warning">{adrs.length} รายการ</Badge>
                  </div>
                  <div className="space-y-1.5">
                    {adrs.map((a, i) => (
                      <div key={i} className="px-2.5 py-1.5 bg-amber-50 border border-amber-100 rounded-lg text-xs">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-slate-800 truncate">{a.med_name}</span>
                          <Badge variant="warning">{a.severity || '—'}</Badge>
                        </div>
                        {a.symptoms && <p className="text-slate-500 mt-0.5">{a.symptoms}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── RIGHT: Prescription timeline ── */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardList size={15} className="text-primary-500" />
                <h2 className="text-sm font-semibold text-slate-700">ประวัติใบสั่งยา</h2>
                {rxList.length > 0 && (
                  <span className="text-xs bg-primary-50 text-primary-600 font-medium px-2 py-0.5 rounded-full">{rxList.length} รายการ</span>
                )}
              </div>

              {rxLoading ? (
                <div className="flex justify-center py-20"><Spinner size={24} /></div>
              ) : rxList.length === 0 ? (
                <div className="text-center py-20 bg-white border border-dashed border-slate-200 rounded-xl">
                  <ClipboardList size={32} className="text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">ไม่มีประวัติใบสั่งยา</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rxList.map(rx => {
                    const s = RX_STATUS[rx.status] ?? { label: rx.status, variant: 'gray' as const, dot: 'bg-slate-400' };
                    return (
                      <button
                        key={rx.prescription_id}
                        onClick={() => openRxDetail(rx)}
                        className="w-full text-left bg-white border border-slate-200 rounded-xl px-4 py-3.5 hover:border-primary-300 hover:shadow-sm transition-all group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            {/* status dot */}
                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${s.dot}`} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-primary-700">{rx.prescription_no}</span>
                                <Badge variant={s.variant}>{s.label}</Badge>
                              </div>
                              <div className="flex flex-wrap gap-x-4 mt-1 text-xs text-slate-500">
                                {rx.doctor_name && (
                                  <span className="flex items-center gap-1">
                                    <Stethoscope size={10} className="text-slate-400" />{rx.doctor_name}
                                  </span>
                                )}
                                {rx.ward && <span>วอร์ด: {rx.ward}</span>}
                                {rx.item_count != null && (
                                  <span className="flex items-center gap-1">
                                    <Pill size={10} className="text-slate-400" />{rx.item_count} รายการ
                                  </span>
                                )}
                              </div>
                              {rx.diagnosis && (
                                <p className="mt-1 text-xs text-slate-400 truncate">วินิจฉัย: {rx.diagnosis}</p>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs text-slate-500">{safeDate(rx.status === 'dispensed' ? rx.dispensed_at : rx.created_at, rx.status === 'dispensed')}</p>
                            {Number(rx.total_cost) > 0 && (
                              <p className="text-xs font-semibold text-primary-700 mt-0.5">
                                {Number(rx.total_cost).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
                              </p>
                            )}
                            <ChevronRight size={13} className="text-slate-300 group-hover:text-primary-400 transition-colors mt-1 ml-auto" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Rx detail modal ── */}
      <Modal
        open={showRxModal}
        onClose={() => setShowRxModal(false)}
        title={rxDetail ? `${rxDetail.prescription_no}` : 'รายละเอียดใบสั่งยา'}
        size="md"
      >
        {rxDetailLoading ? (
          <div className="flex justify-center py-10"><Spinner size={24} /></div>
        ) : rxDetail ? (
          <div className="space-y-4">
            {/* meta grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">สถานะ</p>
                <Badge variant={RX_STATUS[rxDetail.status]?.variant ?? 'gray'}>
                  {RX_STATUS[rxDetail.status]?.label ?? rxDetail.status}
                </Badge>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  {rxDetail.status === 'dispensed' ? 'เวลาจ่าย' : 'วันที่'}
                </p>
                <p className="text-sm font-medium text-slate-700">
                  {safeDate(rxDetail.status === 'dispensed' ? rxDetail.dispensed_at : rxDetail.created_at, rxDetail.status === 'dispensed')}
                </p>
              </div>
              {rxDetail.doctor_name && (
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">แพทย์</p>
                  <p className="text-sm font-medium text-slate-700">{rxDetail.doctor_name}</p>
                </div>
              )}
              {rxDetail.ward && (
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">วอร์ด</p>
                  <p className="text-sm font-medium text-slate-700">{rxDetail.ward}</p>
                </div>
              )}
              {rxDetail.diagnosis && (
                <div className="col-span-2 bg-slate-50 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">วินิจฉัย</p>
                  <p className="text-sm text-slate-700">{rxDetail.diagnosis}</p>
                </div>
              )}
              {rxDetail.note && (
                <div className="col-span-2 bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-1">หมายเหตุจากแพทย์</p>
                  <p className="text-sm text-amber-800">{rxDetail.note}</p>
                </div>
              )}
            </div>

            {/* drug items */}
            {rxDetail.items?.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Pill size={13} className="text-primary-500" />
                  <p className="text-xs font-semibold text-slate-600">รายการยา · {rxDetail.items.length} รายการ</p>
                </div>
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">ชื่อยา</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 whitespace-nowrap">จำนวน</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 whitespace-nowrap">ราคา/หน่วย</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 whitespace-nowrap">รวม</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {rxDetail.items.map((item: any, i: number) => {
                        const unitPrice = Number(item.unit_price) || Number(item.line_total / item.quantity) || 0;
                        const lineTotal = Number(item.line_total) || unitPrice * Number(item.quantity);
                        return (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-800 truncate">{item.med_name ?? item.med_showname}</p>
                              {item.med_generic_name && <p className="text-xs text-slate-400 truncate">{item.med_generic_name}</p>}
                              {(item.frequency || item.route) && (
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {[item.frequency, item.route].filter(Boolean).join(' · ')}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center text-sm text-slate-700">
                              {item.quantity} <span className="text-xs text-slate-400">{item.unit}</span>
                            </td>
                            <td className="px-3 py-3 text-right text-xs text-slate-500">
                              {unitPrice > 0 ? unitPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-semibold text-slate-700">
                              {lineTotal > 0 ? lineTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {rxDetail.items.some((it: any) => Number(it.unit_price) > 0 || Number(it.line_total) > 0) && (
                    <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 bg-slate-50">
                      <span className="text-xs text-slate-500">ยอดรวมทั้งหมด</span>
                      <span className="text-base font-bold text-primary-700">
                        {rxDetail.items
                          .reduce((s: number, it: any) => s + (Number(it.line_total) || (Number(it.unit_price) * Number(it.quantity)) || 0), 0)
                          .toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

    </MainLayout>
  );
}
