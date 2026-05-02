"use client";
import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Sidebar from "./Sidebar";
import { useAlertCount } from "@/lib/alertContext";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Bell, Settings, LogOut, User, Menu } from "lucide-react";
import clsx from "clsx";

interface MainLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function MainLayout({ children, title, subtitle, actions }: MainLayoutProps) {
  const { unreadCount } = useAlertCount();
  const { user, logout } = useAuth();
  const router = useRouter();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [fullName, setFullName] = useState('');
  const userMenuRef = useRef<HTMLDivElement>(null);

  // ดึงชื่อภาษาไทยจาก /auth/me
  useEffect(() => {
    if (!user) return;
    api.get('/auth/me').then(res => {
      const d = res.data;
      const name = [d.firstname_th, d.lastname_th].filter(Boolean).join(' ');
      if (name) setFullName(name);
    }).catch(() => { });
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayName = fullName || user?.email || "ผู้ใช้งาน";
  const roleLabel = user?.role_name ?? '';
  const initials = fullName
    ? fullName.substring(0, 2)
    : (user?.email?.[0]?.toUpperCase() ?? 'U');

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">

      {/* ── Global Header ──────────────────────────────────────────────────── */}
      <header
        className="flex-shrink-0 h-14 sm:h-16 w-full z-50 shadow-md flex items-center justify-between px-3 sm:px-6 text-white relative"
        style={{ background: "linear-gradient(90deg, #003d82 0%, #00306a 100%)" }}
      >
        {/* Left: Logo + Name */}
        <div className="flex items-center gap-1 sm:gap-2 min-w-0 shrink-0">
          <div
            className="flex items-center gap-2 sm:space-x-4 cursor-pointer min-w-0"
            onClick={() => router.push('/')}
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 flex bg-white rounded-xl items-center justify-center shrink-0 overflow-hidden shadow-sm border border-white/20">
              <Image src="/logo.png" alt="Logo" width={44} height={44} className="w-full h-full object-cover p-0.5 sm:p-1" />
            </div>
            <div className="hidden md:block min-w-0">
              <h2 className="font-bold text-[14px] lg:text-[15px] leading-tight py-0.5 truncate">
                โรงพยาบาลวัดห้วยปลากั้งเพื่อสังคม
              </h2>
              <p className="text-[11px] text-blue-100 font-medium truncate">
                PharmSub — ระบบบริหารคลังยาย่อย
              </p>
            </div>
            <div className="block md:hidden min-w-0">
              <h2 className="font-bold text-sm leading-tight truncate">PharmSub</h2>
              <p className="text-[10px] text-blue-100 truncate">ระบบจ่ายยา</p>
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1.5 sm:space-x-4 shrink-0">

          {/* Bell */}
          <button
            onClick={() => router.push("/alerts")}
            className="relative p-1.5 sm:p-2 text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            title="การแจ้งเตือน"
          >
            <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-[#003d82]" />
            )}
          </button>

          {/* Divider */}
          <div className="h-5 sm:h-6 w-px bg-white/20 mx-0.5" />

          {/* User: name + role + avatar */}
          <div className="relative flex items-center gap-2 sm:gap-3 shrink-0" ref={userMenuRef}>
            <div className="hidden md:flex flex-col text-right w-[160px] shrink-0">
              <span className="text-sm font-bold text-white truncate">
                {displayName}
              </span>
              <span className="text-[11px] text-blue-100 font-medium leading-none mt-0.5 truncate">
                {roleLabel || 'PharmSub'}
              </span>
            </div>

            <button
              onClick={() => setShowUserMenu(v => !v)}
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center border border-white/20 text-white text-xs sm:text-sm font-black overflow-hidden cursor-pointer transition-all active:scale-95 shrink-0 shadow-inner"
              title={displayName}
            >
              {user ? initials : <User className="w-4 h-4" />}
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-[110%] w-56 bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] border border-gray-100 overflow-hidden z-50 text-gray-800 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                <div className="p-4 border-b border-gray-50 bg-gray-50/50">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">บัญชีผู้ใช้</p>
                  <p className="text-sm font-bold text-gray-800 truncate">{displayName}</p>
                  {roleLabel && <p className="text-[11px] text-gray-500 truncate mt-0.5">{roleLabel}</p>}
                </div>
                <div className="p-1.5 space-y-0.5">
                  <button
                    onClick={() => { router.push('/settings'); setShowUserMenu(false); }}
                    className="w-full text-left px-3.5 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 rounded-xl flex items-center gap-3 transition-colors cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                      <Settings className="w-4 h-4 text-gray-500 group-hover:text-blue-600" />
                    </div>
                    ตั้งค่าระบบ
                  </button>

                  <button
                    onClick={() => { logout(); setShowUserMenu(false); }}
                    className="w-full text-left px-3.5 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-3 transition-colors cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center group-hover:bg-red-100 transition-colors">
                      <LogOut className="w-4 h-4" />
                    </div>
                    ออกจากระบบ
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Body: Sidebar + Content ─────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside
          style={{ width: isSidebarOpen ? "var(--sidebar-w)" : "64px", minWidth: isSidebarOpen ? "var(--sidebar-w)" : "64px" }}
          className={clsx(
            "h-full flex flex-col flex-shrink-0 shadow-xl bg-white border-r border-slate-200 transition-all duration-300 overflow-x-hidden"
          )}
        >
          <div className={clsx("flex items-center h-14 flex-shrink-0 border-b border-slate-100", isSidebarOpen ? "px-3" : "justify-center")}>
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-slate-500 hover:text-slate-800"
              aria-label="Toggle Sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ width: isSidebarOpen ? "var(--sidebar-w)" : "64px" }}>
            <Sidebar alertCount={unreadCount} isExpanded={isSidebarOpen} />
          </div>
        </aside>

        {/* Main column */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 animate-fade-in">

            {/* Page header */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-slate-800 leading-tight">{title}</h1>
                {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
              </div>
              {actions && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  {actions}
                </div>
              )}
            </div>

            {children}
          </main>

          <footer className="flex-shrink-0 px-4 py-1.5 border-t border-slate-100 bg-white
                             text-center text-xs text-slate-400">
            PharmSub — ระบบบริหารคลังยาย่อย
          </footer>
        </div>
      </div>
    </div>
  );
}
