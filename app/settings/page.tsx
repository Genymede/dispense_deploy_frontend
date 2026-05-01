'use client';
import { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { Card, Input, Button } from '@/components/ui';
import { api } from '@/lib/api';
import { FlaskConical, Save, RefreshCw, X, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

const DEFAULT_UNITS = ['เม็ด', 'แคปซูล', 'ซอง', 'กล่อง', 'ขวด', 'หลอด', 'มล.', 'กรัม', 'ชิ้น', 'ไวแอล', 'แอมพูล'];

export default function SettingsPage() {
  const [drugUnits,    setDrugUnits]    = useState<string[]>(DEFAULT_UNITS);
  const [newUnit,      setNewUnit]      = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [deptName,     setDeptName]     = useState('');
  const [saving,       setSaving]       = useState(false);
  const [apiStatus,    setApiStatus]    = useState<'checking' | 'ok' | 'error'>('checking');
  const [apiInfo,      setApiInfo]      = useState<any>(null);

  useEffect(() => {
    checkApi();
    api.get('/settings').then(res => {
      const d = res.data;
      if (d.hospital_name) setHospitalName(d.hospital_name);
      if (d.dept_name)     setDeptName(d.dept_name);
      if (d.drug_units)    { try { setDrugUnits(JSON.parse(d.drug_units)); } catch { } }
    }).catch(() => {});
  }, []);

  const checkApi = async () => {
    setApiStatus('checking');
    try { const r = await api.get('/health'); setApiStatus('ok'); setApiInfo(r.data); }
    catch { setApiStatus('error'); setApiInfo(null); }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/settings', {
        hospital_name: hospitalName,
        dept_name:     deptName,
        drug_units:    JSON.stringify(drugUnits),
      });
      toast.success('บันทึกเรียบร้อย');
    } catch { toast.error('บันทึกไม่สำเร็จ'); }
    finally { setSaving(false); }
  };

  const addUnit = () => {
    const v = newUnit.trim();
    if (v && !drugUnits.includes(v)) { setDrugUnits(p => [...p, v]); }
    setNewUnit('');
  };

  return (
    <MainLayout title="ตั้งค่าระบบ" subtitle="Settings"
      actions={<Button icon={<Save size={14} />} onClick={save} loading={saving}>บันทึก</Button>}>

      <div className="max-w-2xl space-y-5">

        {/* ── ข้อมูลระบบ ── */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-700 mb-4">ข้อมูลระบบ</h3>
          <div className="space-y-3">
            <Input label="ชื่อโรงพยาบาล" value={hospitalName}
              onChange={e => setHospitalName(e.target.value)}
              placeholder="โรงพยาบาลวัดห้วยปลากั้ง" />
            <Input label="ชื่อแผนก / คลังยา" value={deptName}
              onChange={e => setDeptName(e.target.value)}
              placeholder="แผนกเภสัชกรรม — คลังยาย่อย" />
          </div>
        </Card>

        {/* ── หน่วยยา ── */}
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

        {/* ── สถานะ API ── */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">สถานะ API Backend</h3>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              apiStatus === 'ok'       ? 'bg-green-500' :
              apiStatus === 'error'    ? 'bg-red-500'   :
              'bg-amber-400 animate-pulse'
            }`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700">
                {apiStatus === 'ok' ? 'เชื่อมต่อสำเร็จ' : apiStatus === 'error' ? 'เชื่อมต่อไม่ได้' : 'กำลังตรวจสอบ...'}
              </p>
              {apiInfo && (
                <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">{JSON.stringify(apiInfo)}</p>
              )}
            </div>
            <Button variant="secondary" size="sm" icon={<RefreshCw size={13} />} onClick={checkApi}>
              ตรวจสอบ
            </Button>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-2 px-1">
            {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}
          </p>
        </Card>

      </div>
    </MainLayout>
  );
}
