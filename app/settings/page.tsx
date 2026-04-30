'use client';
import { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { Card, Input, Button, Badge, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Building2, Bell, Users, Save, RefreshCw, UserCircle } from 'lucide-react';
import toast from 'react-hot-toast';

type Tab = 'general' | 'alerts' | 'users';

const ALERT_TYPES = [
  { key: 'alert_enabled_low_stock',   label: 'ยาสต็อกต่ำกว่าขั้นต่ำ',         severity: 'วิกฤต',   def: true  },
  { key: 'alert_enabled_near_expiry', label: 'ยาใกล้หมดอายุ',                  severity: 'เตือน',   def: true  },
  { key: 'alert_enabled_expired',     label: 'ยาหมดอายุ',                       severity: 'วิกฤต',   def: true  },
  { key: 'alert_enabled_overstock',   label: 'ยาเกินสต็อกสูงสุด',              severity: 'ข้อมูล', def: false },
  { key: 'alert_enabled_new_drug',    label: 'ยาใหม่เข้าคลัง (7 วันล่าสุด)',   severity: 'ข้อมูล', def: true  },
];

interface Profile {
  firstname_th: string; lastname_th: string;
  firstname_en: string; lastname_en: string;
  email: string; role_name_th: string;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('general');

  // general
  const [hospitalName, setHospitalName] = useState('');
  const [deptCode,     setDeptCode]     = useState('');
  const [deptName,     setDeptName]     = useState('');
  const [apiStatus,    setApiStatus]    = useState<'checking' | 'ok' | 'error'>('checking');
  const [apiInfo,      setApiInfo]      = useState<any>(null);

  // alerts
  const [lowStockPct,    setLowStockPct]    = useState('100');
  const [nearExpiryDays, setNearExpiryDays] = useState('30');
  const [alertEnabled,   setAlertEnabled]   = useState<Record<string, boolean>>(
    Object.fromEntries(ALERT_TYPES.map(t => [t.key, t.def]))
  );

  // users
  const [users,         setUsers]        = useState<any[]>([]);
  const [loadingUsers,  setLoadingUsers] = useState(false);
  const [profile,       setProfile]      = useState<Profile>({ firstname_th: '', lastname_th: '', firstname_en: '', lastname_en: '', email: '', role_name_th: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => { checkApi(); loadSettings(); }, []);
  useEffect(() => { if (tab === 'users') { loadUsers(); loadProfile(); } }, [tab]);

  const loadSettings = async () => {
    try {
      const res = await api.get('/settings');
      const d = res.data;
      if (d.hospital_name)    setHospitalName(d.hospital_name);
      if (d.dept_code)        setDeptCode(d.dept_code);
      if (d.dept_name)        setDeptName(d.dept_name);
      if (d.near_expiry_days) setNearExpiryDays(d.near_expiry_days);
      if (d.low_stock_pct)    setLowStockPct(d.low_stock_pct);
      setAlertEnabled(prev => {
        const next = { ...prev };
        for (const t of ALERT_TYPES) {
          if (d[t.key] !== undefined) next[t.key] = d[t.key] === 'true';
        }
        return next;
      });
    } catch { }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const payload: Record<string, string> = {
        hospital_name:    hospitalName,
        dept_code:        deptCode,
        dept_name:        deptName,
        near_expiry_days: nearExpiryDays,
        low_stock_pct:    lowStockPct,
      };
      for (const t of ALERT_TYPES) payload[t.key] = String(alertEnabled[t.key]);
      await api.put('/settings', payload);
      toast.success('บันทึกการตั้งค่าเรียบร้อย');
    } catch {
      toast.error('ไม่สามารถบันทึกการตั้งค่าได้');
    } finally { setSavingSettings(false); }
  };

  const checkApi = async () => {
    setApiStatus('checking');
    try {
      const res = await api.get('/health');
      setApiStatus('ok'); setApiInfo(res.data);
    } catch { setApiStatus('error'); }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try { const res = await api.get('/auth/users'); setUsers(res.data ?? []); }
    catch { } finally { setLoadingUsers(false); }
  };

  const loadProfile = async () => {
    try {
      const res = await api.get('/auth/me');
      const d = res.data;
      setProfile({
        firstname_th: d.firstname_th ?? '',
        lastname_th:  d.lastname_th  ?? '',
        firstname_en: d.firstname_en ?? '',
        lastname_en:  d.lastname_en  ?? '',
        email:        d.email        ?? user?.email ?? '',
        role_name_th: d.role_name_th ?? user?.role_name ?? '',
      });
    } catch { }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await api.put('/auth/me', {
        firstname_th: profile.firstname_th,
        lastname_th:  profile.lastname_th,
        firstname_en: profile.firstname_en,
        lastname_en:  profile.lastname_en,
      });
      toast.success('บันทึกข้อมูลเรียบร้อย');
    } catch { toast.error('ไม่สามารถบันทึกข้อมูลได้'); }
    finally { setSavingProfile(false); }
  };

  const fp = (k: keyof Profile, v: string) => setProfile(p => ({ ...p, [k]: v }));

  const TABS = [
    { key: 'general', label: 'ทั่วไป',         icon: <Building2 size={15} /> },
    { key: 'alerts',  label: 'การแจ้งเตือน',   icon: <Bell size={15} /> },
    { key: 'users',   label: 'ผู้ใช้งาน',       icon: <Users size={15} /> },
  ] as const;

  return (
    <MainLayout title="ตั้งค่าระบบ" subtitle="จัดการการตั้งค่าคลังยาย่อย"
      actions={tab !== 'users'
        ? <Button icon={<Save size={14} />} onClick={saveSettings} loading={savingSettings}>บันทึก</Button>
        : undefined}
    >
      <div className="flex gap-6">
        <div className="w-48 shrink-0">
          <nav className="space-y-1">
            {TABS.map(({ key, label, icon }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all ${tab === key ? 'nav-active' : 'text-slate-600 hover:bg-slate-100'}`}>
                {icon}{label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 space-y-5">

          {/* ── ทั่วไป ── */}
          {tab === 'general' && (
            <>
              <Card>
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2"><Building2 size={15} />ข้อมูลระบบ</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="ชื่อโรงพยาบาล" value={hospitalName}
                    onChange={e => setHospitalName(e.target.value)} placeholder="โรงพยาบาลวัดห้วยปลากั้ง" />
                  <Input label="รหัสแผนก" value={deptCode}
                    onChange={e => setDeptCode(e.target.value)} placeholder="PHARM-SUB-01" />
                  <div className="col-span-2">
                    <Input label="ชื่อแผนก / คลังยา" value={deptName}
                      onChange={e => setDeptName(e.target.value)} placeholder="แผนกเภสัชกรรม — คลังยาย่อย" />
                  </div>
                </div>
              </Card>
              <Card>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">สถานะ API Backend</h3>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className={`w-3 h-3 rounded-full ${apiStatus === 'ok' ? 'bg-green-500' : apiStatus === 'error' ? 'bg-red-500' : 'bg-amber-400 animate-pulse'}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700">
                      {apiStatus === 'ok' ? 'เชื่อมต่อสำเร็จ' : apiStatus === 'error' ? 'เชื่อมต่อไม่ได้' : 'กำลังตรวจสอบ...'}
                    </p>
                    {apiInfo && <p className="text-xs text-slate-400 font-mono mt-0.5">{JSON.stringify(apiInfo)}</p>}
                  </div>
                  <Button variant="secondary" size="sm" icon={<RefreshCw size={13} />} onClick={checkApi}>ตรวจสอบ</Button>
                </div>
                <div className="mt-3 p-2.5 bg-slate-50 rounded-lg font-mono text-xs text-slate-600 select-all">
                  API_URL = {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}
                </div>
              </Card>
            </>
          )}

          {/* ── การแจ้งเตือน ── */}
          {tab === 'alerts' && (
            <>
              <Card>
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2"><Bell size={15} />เกณฑ์การแจ้งเตือน</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="แจ้งเตือนเมื่อสต็อกต่ำกว่า (%)" type="number" value={lowStockPct}
                    onChange={e => setLowStockPct(e.target.value)} suffix="%" />
                  <Input label="แจ้งเตือนก่อนยาหมดอายุ (วัน)" type="number" value={nearExpiryDays}
                    onChange={e => setNearExpiryDays(e.target.value)} suffix="วัน" />
                </div>
                <p className="text-xs text-slate-400 mt-3">
                  * ระบบจะสร้างการแจ้งเตือนอัตโนมัติจากข้อมูล med_subwarehouse เมื่อ min_quantity และ exp_date ถูกกำหนดไว้
                </p>
              </Card>
              <Card>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">ประเภทการแจ้งเตือน</h3>
                <div className="space-y-2">
                  {ALERT_TYPES.map(({ key, label, severity }) => (
                    <div key={key} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={alertEnabled[key]}
                          onChange={e => setAlertEnabled(prev => ({ ...prev, [key]: e.target.checked }))}
                          className="w-4 h-4 text-primary-600" />
                        <span className="text-sm text-slate-700">{label}</span>
                      </div>
                      <Badge variant={severity === 'วิกฤต' ? 'danger' : severity === 'เตือน' ? 'warning' : 'info'}>
                        {severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}

          {/* ── ผู้ใช้งาน ── */}
          {tab === 'users' && (
            <>
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <UserCircle size={15} />ข้อมูลของฉัน
                  </h3>
                  <Button size="sm" icon={<Save size={13} />} onClick={saveProfile} loading={savingProfile}>บันทึก</Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="ชื่อ (ภาษาไทย)"    value={profile.firstname_th} onChange={e => fp('firstname_th', e.target.value)} />
                  <Input label="นามสกุล (ภาษาไทย)"  value={profile.lastname_th}  onChange={e => fp('lastname_th',  e.target.value)} />
                  <Input label="ชื่อ (ภาษาอังกฤษ)"  value={profile.firstname_en} onChange={e => fp('firstname_en', e.target.value)} />
                  <Input label="นามสกุล (ภาษาอังกฤษ)" value={profile.lastname_en} onChange={e => fp('lastname_en',  e.target.value)} />
                  <Input label="อีเมล"   value={profile.email}        disabled />
                  <Input label="บทบาท"  value={profile.role_name_th} disabled />
                </div>
              </Card>

              <Card className="overflow-hidden p-0">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-700">ผู้ใช้งานระบบ</h3>
                </div>
                {loadingUsers ? (
                  <div className="flex justify-center py-12"><Spinner /></div>
                ) : users.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-slate-500">ไม่พบข้อมูลผู้ใช้งาน</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>{['ชื่อ-นามสกุล', 'อีเมล', 'บทบาท', 'สถานะ'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {users.map((u: any) => (
                        <tr key={u.id || u.uid}
                          className={`table-row-hover ${u.id === user?.id ? 'bg-primary-50/40' : ''}`}>
                          <td className="px-4 py-3 font-medium text-slate-800">{u.full_name || u.username || '—'}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{u.email}</td>
                          <td className="px-4 py-3 text-xs text-slate-600">{u.role_name_th || `Role ${u.role_id}`}</td>
                          <td className="px-4 py-3"><Badge variant="success" dot>ใช้งาน</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </>
          )}

        </div>
      </div>
    </MainLayout>
  );
}
