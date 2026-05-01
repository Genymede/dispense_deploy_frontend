'use client';
import { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { Card, Input, Button, Badge } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Bell, Save, UserCircle, FlaskConical, X, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

type Tab = 'profile' | 'alerts' | 'units';

const DEFAULT_UNITS = ['เม็ด', 'แคปซูล', 'ซอง', 'กล่อง', 'ขวด', 'หลอด', 'มล.', 'กรัม', 'ชิ้น', 'ไวแอล', 'แอมพูล'];

const ALERT_TYPES = [
  { key: 'alert_enabled_low_stock',   label: 'ยาสต็อกต่ำกว่าขั้นต่ำ',       severity: 'วิกฤต',   def: true  },
  { key: 'alert_enabled_near_expiry', label: 'ยาใกล้หมดอายุ',                severity: 'เตือน',   def: true  },
  { key: 'alert_enabled_expired',     label: 'ยาหมดอายุ',                     severity: 'วิกฤต',   def: true  },
  { key: 'alert_enabled_overstock',   label: 'ยาเกินสต็อกสูงสุด',            severity: 'ข้อมูล', def: false },
  { key: 'alert_enabled_new_drug',    label: 'ยาใหม่เข้าคลัง (7 วันล่าสุด)', severity: 'ข้อมูล', def: true  },
];

interface Profile {
  firstname_th: string; lastname_th: string;
  firstname_en: string; lastname_en: string;
  email: string; role_name_th: string;
}

const TABS = [
  { key: 'profile' as Tab, label: 'โปรไฟล์',        icon: <UserCircle size={15} /> },
  { key: 'alerts'  as Tab, label: 'การแจ้งเตือน',   icon: <Bell size={15} /> },
  { key: 'units'   as Tab, label: 'หน่วยยา',         icon: <FlaskConical size={15} /> },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');

  // profile
  const [profile,       setProfile]      = useState<Profile>({ firstname_th: '', lastname_th: '', firstname_en: '', lastname_en: '', email: '', role_name_th: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  // alerts
  const [nearExpiryDays, setNearExpiryDays] = useState('30');
  const [lowStockPct,    setLowStockPct]    = useState('100');
  const [alertEnabled,   setAlertEnabled]   = useState<Record<string, boolean>>(
    Object.fromEntries(ALERT_TYPES.map(t => [t.key, t.def]))
  );

  // units
  const [drugUnits, setDrugUnits] = useState<string[]>(DEFAULT_UNITS);
  const [newUnit,   setNewUnit]   = useState('');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/auth/me').then(res => {
      const d = res.data;
      setProfile({
        firstname_th: d.firstname_th ?? '',
        lastname_th:  d.lastname_th  ?? '',
        firstname_en: d.firstname_en ?? '',
        lastname_en:  d.lastname_en  ?? '',
        email:        d.email        ?? user?.email ?? '',
        role_name_th: d.role_name_th ?? user?.role_name ?? '',
      });
    }).catch(() => {});

    api.get('/settings').then(res => {
      const d = res.data;
      if (d.near_expiry_days) setNearExpiryDays(d.near_expiry_days);
      if (d.low_stock_pct)    setLowStockPct(d.low_stock_pct);
      if (d.drug_units)       { try { setDrugUnits(JSON.parse(d.drug_units)); } catch { } }
      setAlertEnabled(prev => {
        const next = { ...prev };
        for (const t of ALERT_TYPES) {
          if (d[t.key] !== undefined) next[t.key] = d[t.key] === 'true';
        }
        return next;
      });
    }).catch(() => {});
  }, []);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await api.put('/auth/me', {
        firstname_th: profile.firstname_th,
        lastname_th:  profile.lastname_th,
        firstname_en: profile.firstname_en,
        lastname_en:  profile.lastname_en,
      });
      toast.success('บันทึกโปรไฟล์เรียบร้อย');
    } catch { toast.error('บันทึกไม่สำเร็จ'); }
    finally { setSavingProfile(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        near_expiry_days: nearExpiryDays,
        low_stock_pct:    lowStockPct,
        drug_units:       JSON.stringify(drugUnits),
      };
      for (const t of ALERT_TYPES) payload[t.key] = String(alertEnabled[t.key]);
      await api.put('/settings', payload);
      toast.success('บันทึกเรียบร้อย');
    } catch { toast.error('บันทึกไม่สำเร็จ'); }
    finally { setSaving(false); }
  };

  const addUnit = () => {
    const v = newUnit.trim();
    if (v && !drugUnits.includes(v)) setDrugUnits(p => [...p, v]);
    setNewUnit('');
  };

  const fp = (k: keyof Profile, v: string) => setProfile(p => ({ ...p, [k]: v }));

  return (
    <MainLayout title="ตั้งค่าระบบ" subtitle="Settings"
      actions={tab !== 'profile'
        ? <Button icon={<Save size={14} />} onClick={save} loading={saving}>บันทึก</Button>
        : undefined}>

      <div className="flex gap-6">

        {/* ── Sidebar nav ── */}
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

        {/* ── Content ── */}
        <div className="flex-1 max-w-2xl space-y-5">

          {/* ── โปรไฟล์ ── */}
          {tab === 'profile' && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <UserCircle size={15} />ข้อมูลของฉัน
                </h3>
                <Button size="sm" variant="secondary" icon={<Save size={13} />}
                  onClick={saveProfile} loading={savingProfile}>
                  บันทึก
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="ชื่อ (ภาษาไทย)"      value={profile.firstname_th} onChange={e => fp('firstname_th', e.target.value)} />
                <Input label="นามสกุล (ภาษาไทย)"   value={profile.lastname_th}  onChange={e => fp('lastname_th',  e.target.value)} />
                <Input label="ชื่อ (ภาษาอังกฤษ)"   value={profile.firstname_en} onChange={e => fp('firstname_en', e.target.value)} />
                <Input label="นามสกุล (ภาษาอังกฤษ)" value={profile.lastname_en}  onChange={e => fp('lastname_en',  e.target.value)} />
                <Input label="อีเมล"  value={profile.email}        disabled />
                <Input label="บทบาท" value={profile.role_name_th} disabled />
              </div>
            </Card>
          )}

          {/* ── การแจ้งเตือน ── */}
          {tab === 'alerts' && (
            <>
              <Card>
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Bell size={15} />เกณฑ์การแจ้งเตือน
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="แจ้งเตือนก่อนยาหมดอายุ" type="number" suffix="วัน"
                    value={nearExpiryDays} onChange={e => setNearExpiryDays(e.target.value)} />
                  <Input label="แจ้งเตือนสต็อกต่ำกว่า" type="number" suffix="%"
                    value={lowStockPct} onChange={e => setLowStockPct(e.target.value)} />
                </div>
              </Card>
              <Card>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">ประเภทการแจ้งเตือน</h3>
                <div className="space-y-2">
                  {ALERT_TYPES.map(({ key, label, severity }) => (
                    <label key={key} className="flex items-center justify-between p-2.5 border border-slate-100 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={alertEnabled[key]}
                          onChange={e => setAlertEnabled(p => ({ ...p, [key]: e.target.checked }))}
                          className="w-4 h-4 text-primary-600 rounded" />
                        <span className="text-sm text-slate-700">{label}</span>
                      </div>
                      <Badge variant={severity === 'วิกฤต' ? 'danger' : severity === 'เตือน' ? 'warning' : 'info'}>
                        {severity}
                      </Badge>
                    </label>
                  ))}
                </div>
              </Card>
            </>
          )}

          {/* ── หน่วยยา ── */}
          {tab === 'units' && (
            <Card>
              <h3 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
                <FlaskConical size={15} />หน่วยยา / รูปแบบบรรจุ
              </h3>
              <p className="text-xs text-slate-400 mb-4">ใช้เป็น dropdown ในหน้าเพิ่มยาและทะเบียนยาหลัก</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {drugUnits.map((u, i) => (
                  <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg text-sm text-slate-700">
                    {u}
                    <button onClick={() => setDrugUnits(p => p.filter((_, j) => j !== i))}
                      className="text-slate-400 hover:text-red-500 transition-colors">
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" value={newUnit}
                  onChange={e => setNewUnit(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addUnit(); }}
                  placeholder="พิมพ์หน่วยใหม่ แล้วกด Enter หรือ +"
                  className="flex-1 h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300"
                />
                <button onClick={addUnit}
                  className="h-9 px-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-1 text-sm">
                  <Plus size={14} />เพิ่ม
                </button>
              </div>
            </Card>
          )}

        </div>
      </div>
    </MainLayout>
  );
}
