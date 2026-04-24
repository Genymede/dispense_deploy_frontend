"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  Package, Truck, Pill, Bell, Settings, ChevronRight,
  BarChart3, BookOpen, LogOut, ChevronDown,
  Database, ShieldAlert, FlaskConical, Repeat2,
  Stethoscope, ClipboardList, Clock, FileWarning,
  AlertTriangle, FileText, CalendarClock,
  LayoutDashboard, ArrowDownToLine, Activity, Tag,
} from "lucide-react";
import clsx from "clsx";
import { useState } from "react";

interface NavItem { href: string; label: string; icon: React.ElementType; }
interface NavGroup { label: string; icon: React.ElementType; basePath: string; items: NavItem[]; }

const warehouseGroup: NavGroup = {
  label: "คลังยาย่อย", icon: Pill,
  basePath: "/___none___", // ไม่มี basePath เดียว ตรวจ active แยก
  items: [
    { href: "/dashboard", label: "ภาพรวม", icon: LayoutDashboard },
    { href: "/drugs", label: "รายการยาในคลัง", icon: Pill },
    { href: "/stock-in", label: "รับยาเข้าคลัง", icon: ArrowDownToLine },
  ],
};

const registryGroup: NavGroup = {
  label: "ทะเบียน", icon: BookOpen, basePath: "/registry",
  items: [
    { href: "/registry", label: "ทะเบียนยาหลัก", icon: Database },
    { href: "/registry/allergy", label: "การแพ้ยา", icon: ShieldAlert },
    { href: "/registry/adr", label: "ADR", icon: FlaskConical },
    { href: "/registry/med-interactions", label: "ปฏิกิริยายา", icon: Repeat2 },
    { href: "/registry/med-usage", label: "ประวัติใช้ยา", icon: Stethoscope },
    { href: "/registry/dispense-history", label: "ประวัติจ่ายยา", icon: ClipboardList },
    { href: "/registry/delivery", label: "การจัดส่งยา", icon: Truck },
    { href: "/registry/overdue", label: "ยาค้างจ่าย", icon: Clock },
    { href: "/registry/rad", label: "RAD Registry", icon: FileWarning },
    { href: "/registry/med-movement", label: "การเคลื่อนไหวยา", icon: Activity },
  ],
};

const reportsGroup: NavGroup = {
  label: "รายงาน", icon: BarChart3, basePath: "/reports",
  items: [
    { href: "/reports", label: "ภาพรวมรายงาน", icon: BarChart3 },
    { href: "/reports/expiry", label: "ยาหมดอายุ / สต็อกต่ำ", icon: AlertTriangle },
    { href: "/reports/med-table", label: "ทะเบียนยา", icon: BookOpen },
    { href: "/reports/med-subwarehouse", label: "คลังยาย่อย", icon: Database },

    { href: "/reports/med-order-history", label: "ประวัติสั่งยา", icon: ClipboardList },
    { href: "/reports/med-usage-history", label: "ประวัติใช้ยา", icon: Stethoscope },
    { href: "/reports/allergy-registry", label: "การแพ้ยา", icon: ShieldAlert },
    { href: "/reports/adr-registry", label: "ADR", icon: FlaskConical },
    { href: "/reports/med-interaction", label: "ปฏิกิริยายา", icon: Repeat2 },
    { href: "/reports/error-medication", label: "Medication Error", icon: FileWarning },
    { href: "/reports/med-problem", label: "ปัญหาการใช้ยา", icon: AlertTriangle },
    { href: "/reports/med-delivery", label: "การจัดส่ง", icon: Truck },
    { href: "/reports/overdue-med", label: "ยาค้างจ่าย", icon: Clock },
    { href: "/reports/cut-off", label: "Cut-off Period", icon: CalendarClock },
    { href: "/reports/rad-registry", label: "RAD", icon: FileText },
    { href: "/transactions", label: "ประวัติเคลื่อนไหวยา", icon: Activity },
  ],
};

function CollapseGroup({ group }: { group: NavGroup }) {
  const pathname = usePathname();
  const isActive = group.basePath !== "/___none___"
    ? pathname.startsWith(group.basePath)
    : group.items.some(i => pathname === i.href || pathname.startsWith(i.href + '/'));
  const [open, setOpen] = useState(isActive);
  const Icon = group.icon;

  return (
    <div>
      <button onClick={() => setOpen(!open)}
        className={clsx(
          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all",
          isActive ? "bg-white/15 text-white font-semibold" : "text-blue-100/80 hover:bg-white/10 hover:text-white"
        )}
      >
        <Icon size={16} className={isActive ? "text-blue-200" : "text-blue-300/60"} />
        <span className="flex-1 text-left text-[13px]">{group.label}</span>
        <ChevronDown size={12} className={clsx("text-blue-300/50 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div className="ml-3.5 mt-0.5 border-l border-white/10 pl-2.5 space-y-0.5">
          {group.items.map(({ href, label, icon: ItemIcon }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href}
                className={clsx(
                  "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all",
                  active ? "bg-white/15 text-white font-semibold" : "text-blue-100/60 hover:bg-white/8 hover:text-blue-100"
                )}
              >
                <ItemIcon size={13} className={active ? "text-blue-200" : "text-blue-300/40"} />
                <span className="flex-1">{label}</span>
                {active && <span className="w-1.5 h-1.5 rounded-full bg-blue-300" />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NavLink({ href, label, icon: Icon, badge }: NavItem & { badge?: number }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link href={href}
      className={clsx(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all group",
        active ? "bg-white/15 text-white font-semibold" : "text-blue-100/80 hover:bg-white/10 hover:text-white"
      )}
    >
      <Icon size={16} className={active ? "text-blue-200" : "text-blue-300/60 group-hover:text-blue-200"} />
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="relative flex items-center justify-center">
          <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
          <span className="relative min-w-[20px] h-5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {badge > 99 ? "99+" : badge}
          </span>
        </span>
      )}
      {active && <ChevronRight size={13} className="text-blue-300/60" />}
    </Link>
  );
}

function SidebarFooter() {
  const { user, logout } = useAuth();

  const displayName = user?.email ?? null;
  const initials = displayName?.[0]?.toUpperCase() ?? 'U';
  const roleLabel = user?.role_name ?? 'กำลังโหลด...';

  return (
    <div className="px-3 py-3 border-t border-white/10 flex-shrink-0">
      <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white/8 hover:bg-white/12 transition-colors">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-300 to-blue-500 flex items-center justify-center flex-shrink-0 shadow-sm">
          <span className="text-white text-xs font-bold">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">
            {displayName ?? 'ผู้ใช้งาน'}
          </p>
          <p className="text-[10px] text-blue-200/60 truncate">
            {roleLabel}
          </p>
        </div>
        <button onClick={logout}
          className="text-blue-200/40 hover:text-red-400 transition-colors flex-shrink-0 p-1 rounded-lg hover:bg-white/10" title="ออกจากระบบ">
          <LogOut size={14} />
        </button>
      </div>
    </div>
  );
}

export default function Sidebar({ alertCount = 0 }: { alertCount?: number }) {
  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 shadow-md border border-white/20">
            <Image src="/logo.png" alt="Logo" width={40} height={40} className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">โรวพยาบาลวัดห้วยปลากั้ง</p>
            <p className="text-[10px] text-blue-200/70 leading-tight">ระบบจ่ายยา</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
        <NavLink href="/dispense" label="จ่ายยา" icon={Package} />
        <NavLink href="/delivery" label="จัดส่งยา" icon={Truck} />
        <div className="pt-2 pb-0.5 px-2">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-blue-300/40">ทะเบียน & รายงาน</p>
        </div>
        <CollapseGroup group={registryGroup} />
        <CollapseGroup group={reportsGroup} />
        <div className="pt-2 pb-0.5 px-2">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-blue-300/40">คลังยา</p>
        </div>
        <CollapseGroup group={warehouseGroup} />
        <div className="pt-2 pb-0.5 px-2">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-blue-300/40">อื่นๆ</p>
        </div>
        <NavLink href="/sticker" label="สติ๊กเกอร์ยา" icon={Tag} />
        <NavLink href="/alerts" label="แจ้งเตือน" icon={Bell} badge={alertCount} />
        <NavLink href="/settings" label="ตั้งค่า" icon={Settings} />
      </nav>

      <SidebarFooter />
    </div>
  );
}
