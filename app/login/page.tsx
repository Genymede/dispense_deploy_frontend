'use client';
import { useState, useEffect, FormEvent } from 'react';
import Image from 'next/image';
import { useAuth } from '@/lib/auth';
import { Eye, EyeOff, ExternalLink, Loader2, Lock, User } from 'lucide-react';

const PORTAL_URL = 'https://hpk-hms.site';
const IS_DEV = process.env.NODE_ENV === 'development';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // Production: redirect ไป portal อัตโนมัติ
  useEffect(() => {
    if (IS_DEV) return;
    const t = setTimeout(() => { window.location.href = PORTAL_URL; }, 3000);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username || !password) { setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน'); return; }
    setLoading(true); setError('');
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel ── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center px-12 py-16 relative overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #003d82 0%, #00306a 100%)' }}
      >
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #60a5fa, transparent)' }} />
        <div className="absolute -bottom-32 -right-20 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #93c5fd, transparent)' }} />
        <div className="relative z-10 text-center">
          <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 mx-auto mb-6">
            <Image src="/logo.png" alt="Logo" width={96} height={96} className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold text-white leading-tight">
            โรงพยาบาลวัดห้วยปลากั้ง<br />เพื่อสังคม
          </h1>
          <div className="w-12 h-0.5 bg-blue-300/50 mx-auto my-4" />
          <p className="text-blue-200 text-sm leading-relaxed">
            ระบบบริหารจัดการคลังยาย่อย<br />
            Pharmacy Sub-Warehouse Management
          </p>
        </div>
        <p className="absolute bottom-6 text-blue-300/40 text-xs">PharmSub v19</p>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-sm">

          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg border border-slate-200 mx-auto mb-3">
              <Image src="/logo.png" alt="Logo" width={64} height={64} className="w-full h-full object-cover" />
            </div>
            <h1 className="text-lg font-bold text-slate-800">โรงพยาบาลวัดห้วยปลากั้งเพื่อสังคม</h1>
            <p className="text-slate-500 text-xs mt-1">ระบบบริหารจัดการคลังยาย่อย</p>
          </div>

          {IS_DEV ? (
            /* ── Development: แสดง login form เดิม ── */
            <>
              <h2 className="text-2xl font-bold text-slate-800 mb-1">เข้าสู่ระบบ</h2>
              <p className="text-sm text-slate-500 mb-8">กรุณาใส่ข้อมูลเพื่อเข้าใช้งาน</p>

              {error && (
                <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
                  <span className="shrink-0">⚠</span> {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5 uppercase tracking-wide">
                    ชื่อผู้ใช้ / อีเมล
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><User size={15} /></span>
                    <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                      placeholder="username หรือ email" autoComplete="username" autoFocus disabled={loading}
                      className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all placeholder:text-slate-300" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5 uppercase tracking-wide">
                    รหัสผ่าน
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><Lock size={15} /></span>
                    <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="รหัสผ่าน" autoComplete="current-password" disabled={loading}
                      className="w-full h-11 pl-10 pr-11 bg-white border border-slate-200 rounded-xl text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all placeholder:text-slate-300" />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full h-11 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 mt-2">
                  {loading ? <><Loader2 size={16} className="animate-spin" /> กำลังเข้าสู่ระบบ...</> : 'เข้าสู่ระบบ'}
                </button>
              </form>
            </>
          ) : (
            /* ── Production: redirect ไป portal ── */
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <Loader2 size={32} className="animate-spin text-primary-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">กำลังนำทางไปยัง Portal</h2>
              <p className="text-sm text-slate-500 mb-8">
                กรุณาเข้าสู่ระบบผ่าน Portal หลักของโรงพยาบาล<br />
                ระบบจะนำทางอัตโนมัติใน 3 วินาที
              </p>
              <a href={PORTAL_URL}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
                <ExternalLink size={15} />
                ไปยัง Portal ทันที
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
