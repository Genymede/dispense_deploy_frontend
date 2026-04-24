"use client";
import Sidebar from "./Sidebar";
import { useAlertCount } from "@/lib/alertContext";

interface MainLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function MainLayout({ children, title, subtitle, actions }: MainLayoutProps) {
  const { unreadCount } = useAlertCount();
  return (
    // Full-height flex row — nothing overflows at this level
    <div className="flex h-screen overflow-hidden bg-slate-50">

      {/* ── Sidebar: fixed width, scrolls independently ──────────────────── */}
      <aside
        style={{ width: "var(--sidebar-w)", minWidth: "var(--sidebar-w)", background: "linear-gradient(180deg, #003d82 0%, #00306a 100%)" }}
        className="h-screen flex flex-col flex-shrink-0 shadow-xl"
      >
        {/* inner wrapper scrolls when content overflows */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <Sidebar alertCount={unreadCount} />
        </div>
      </aside>

      {/* ── Main column: takes remaining width ───────────────────────────── */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">

        {/* Topbar — never scrolls away */}
        <header className="flex-shrink-0 h-14 bg-white border-b-2 border-primary-500
                           px-6 flex items-center gap-4 z-20 shadow-sm">
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-slate-800 truncate leading-tight">{title}</h1>
            {subtitle && <p className="text-xs text-slate-500 truncate leading-tight">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
        </header>

        {/* ── Page content: scrollable ─────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 animate-fade-in">
          {children}
        </main>

        <footer className="flex-shrink-0 px-6 py-2 border-t border-slate-100 bg-white
                           text-center text-xs text-slate-400">
          PharmSub — ระบบบริหารคลังยาย่อย
        </footer>
      </div>
    </div>
  );
}
