'use client';
import { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { Card, Input, Button, Badge, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { Building2, Bell, Shield, Users, Save, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

type Tab = 'general' | 'alerts' | 'users' | 'security';

interface User { uid: number; username: string; email: string; phone: string; role_id: number; role_name_th?: string; }

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('general');
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [apiInfo, setApiInfo] = useState<any>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // alert thresholds — loaded from backend
  const [lowStockPct, setLowStockPct] = useState('100');
  const [nearExpiryDays, setNearExpiryDays] = useState('30');

  useEffect(() => {
    checkApi();
    loadSettings();
  }, []);

  useEffect(() => {
    if (tab === 'users') loadUsers();
  }, [tab]);

  const loadSettings = async () => {
    try {
      const res = await api.get('/settings');
      if (res.data.near_expiry_days) setNearExpiryDays(res.data.near_expiry_days);
      if (res.data.low_stock_pct) setLowStockPct(res.data.low_stock_pct);
    } catch { /* ignore — settings table may not exist yet */ }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.put('/settings', { near_expiry_days: nearExpiryDays, low_stock_pct: lowStockPct });
      toast.success('บันทึกการตั้งค่าเรียบร้อย');
    } catch {
      toast.error('ไม่สามารถบันทึกการตั้งค่าได้');
    } finally {
      setSavingSettings(false);
    }
  };

  const checkApi = async () => {
    setApiStatus('checking');
    try {
      const res = await api.get('/health');
      setApiStatus('ok');
      setApiInfo(res.data);
    } catch {
      setApiStatus('error');
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await api.get('/auth/users');
      setUsers(res.data ?? []);
    } catch { }
    finally { setLoadingUsers(false); }
  };

  const TABS = [
    { key: 'general', label: 'ทั่วไป', icon: <Building2 size={15} /> },
    { key: 'alerts', label: 'การแจ้งเตือน', icon: <Bell size={15} /> },
    { key: 'users', label: 'ผู้ใช้งาน', icon: <Users size={15} /> },
    //{ key: 'security', label: 'ความปลอดภัย', icon: <Shield size={15} /> },
  ] as const;

  return (
    <MainLayout title="ตั้งค่าระบบ" subtitle="จัดการการตั้งค่าคลังยาย่อย"
      actions={<Button icon={<Save size={14} />} onClick={saveSettings} disabled={savingSettings}>{savingSettings ? 'กำลังบันทึก...' : 'บันทึก'}</Button>}
    >
      <div className="flex gap-6">
        {/* Sidebar */}
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

        {/* Content */}
        <div className="flex-1 space-y-5">

          {tab === 'general' && (
            <>
              <Card>
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2"><Building2 size={15} />ข้อมูลระบบ</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="ชื่อโรงพยาบาล" defaultValue="โรงพยาบาลตัวอย่าง" />
                  <Input label="รหัสแผนก" defaultValue="PHARM-SUB-01" />
                  <div className="col-span-2">
                    <Input label="ชื่อแผนก / คลังยา" defaultValue="แผนกเภสัชกรรม — คลังยาย่อย" />
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

          {tab === 'alerts' && (
            <>
              <Card>
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2"><Bell size={15} />เกณฑ์การแจ้งเตือน</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="แจ้งเตือนเมื่อสต็อกต่ำกว่า (%)" type="number" value={lowStockPct}
                    onChange={(e) => setLowStockPct(e.target.value)} suffix="%" />
                  <Input label="แจ้งเตือนก่อนยาหมดอายุ (วัน)" type="number" value={nearExpiryDays}
                    onChange={(e) => setNearExpiryDays(e.target.value)} suffix="วัน" />
                </div>
                <p className="text-xs text-slate-400 mt-3">
                  * ระบบจะสร้างการแจ้งเตือนอัตโนมัติจากข้อมูล med_subwarehouse เมื่อ min_quantity และ exp_date ถูกกำหนดไว้
                </p>
              </Card>
              <Card>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">ประเภทการแจ้งเตือน</h3>
                <div className="space-y-2">
                  {[
                    { label: 'ยาสต็อกต่ำกว่าขั้นต่ำ', severity: 'วิกฤต' as const, enabled: true },
                    { label: 'ยาใกล้หมดอายุ (ภายใน 30 วัน)', severity: 'เตือน' as const, enabled: true },
                    { label: 'ยาหมดอายุ', severity: 'วิกฤต' as const, enabled: true },
                    { label: 'ยาเกินสต็อกสูงสุด', severity: 'ข้อมูล' as const, enabled: false },
                  ].map(({ label, severity, enabled }) => (
                    <div key={label} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" defaultChecked={enabled} className="w-4 h-4 text-primary-600" />
                        <span className="text-sm text-slate-700">{label}</span>
                      </div>
                      <Badge variant={severity === 'วิกฤต' ? 'danger' : severity === 'เตือน' ? 'warning' : 'info'}>{severity}</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}

          {tab === 'users' && (
            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700">ผู้ใช้งานระบบ</h3>
              </div>
              {loadingUsers ? (
                <div className="flex justify-center py-12"><Spinner /></div>
              ) : users.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-slate-500">ข้อมูลผู้ใช้งานจะแสดงเมื่อเชื่อมต่อ API</p>
                  <p className="text-xs text-slate-400 mt-1 font-mono">GET /api/users</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>{['ชื่อผู้ใช้', 'อีเมล', 'บทบาท', 'สถานะ'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {users.map((u) => (
                      <tr key={u.uid} className="table-row-hover">
                        <td className="px-4 py-3 font-medium text-slate-800">{u.username}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{u.email}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{u.role_name_th || `Role ${u.role_id}`}</td>
                        <td className="px-4 py-3"><Badge variant="success" dot>ใช้งาน</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          )}

          {tab === 'security' && (
            <Card>
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2"><Shield size={15} />การตั้งค่าความปลอดภัย</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Input label="หมดอายุ Session (นาที)" type="number" defaultValue="60" suffix="นาที" />
                <Input label="บังคับเปลี่ยนรหัสทุก (วัน)" type="number" defaultValue="90" suffix="วัน" />
              </div>
              <div className="space-y-2">
                {[
                  'บังคับใช้รหัสผ่านที่ซับซ้อน',
                  'บันทึก audit log ทุกการกระทำ',
                  'ล็อกบัญชีหลังพยายามเข้าระบบผิด 5 ครั้ง',
                ].map((label) => (
                  <div key={label} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <input type="checkbox" defaultChecked className="w-4 h-4 text-primary-600" />
                    <span className="text-sm text-slate-700">{label}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
