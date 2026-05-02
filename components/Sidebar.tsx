"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Package, Truck, Pill, Bell, Settings, ChevronRight,
  BarChart3, BookOpen, ChevronDown,
  Database, ShieldAlert, FlaskConical, Repeat2,
  Stethoscope, ClipboardList, Clock, FileText,
  AlertTriangle, FileWarning,
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
    { href: "/dashboard", label: "ภาพรวมคลังย่อย", icon: LayoutDashboard },
    { href: "/drugs", label: "ยาคงคลัง", icon: Pill },
    { href: "/stock-in", label: "รายการคำขอเบิกยา", icon: ArrowDownToLine },
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
    { href: "/registry/med-problem", label: "ปัญหาการใช้ยา", icon: AlertTriangle },
    { href: "/registry/med-movement", label: "การเคลื่อนไหวยา", icon: Activity },
  ],
};

const reportsGroup: NavGroup = {
  label: "รายงาน", icon: BarChart3, basePath: "/___none___",
  items: [
    { href: "/reports/expiry", label: "ยาหมดอายุ / สต็อกต่ำ", icon: AlertTriangle },
    { href: "/reports/med-table", label: "ทะเบียนยาหลัก", icon: BookOpen },
    { href: "/reports/med-subwarehouse", label: "ยาคงคลัง", icon: Database },

    { href: "/reports/med-order-history", label: "ประวัติการจ่ายยา", icon: ClipboardList },
    { href: "/reports/med-usage-history", label: "ประวัติใช้ยา", icon: Stethoscope },
    { href: "/reports/allergy-registry", label: "การแพ้ยา", icon: ShieldAlert },
    { href: "/reports/adr-registry", label: "อาการไม่พึงประสงค์จากยา", icon: FlaskConical },
    { href: "/reports/med-interaction", label: "ปฏิกิริยาของยา", icon: Repeat2 },
    { href: "/reports/med-problem", label: "ปัญหาการใช้ยา", icon: AlertTriangle },
    { href: "/reports/med-delivery", label: "การจัดส่งยา", icon: Truck },
    { href: "/reports/overdue-med", label: "ยาค้างจ่าย", icon: Clock },
    { href: "/reports/rad-registry", label: "ยาปฏิชีวนะควบคุม", icon: FileText },
    { href: "/transactions", label: "ประวัติเคลื่อนไหวยา", icon: Activity },
  ],
};

function CollapseGroup({ group, isExpanded }: { group: NavGroup; isExpanded?: boolean }) {
  const pathname = usePathname();
  const isActive = group.basePath !== "/___none___"
    ? pathname.startsWith(group.basePath)
    : group.items.some(i => pathname === i.href || pathname.startsWith(i.href + '/'));
  const [open, setOpen] = useState(isActive);
  const Icon = group.icon;

  return (
    <div>
      <button onClick={() => isExpanded && setOpen(!open)}
        title={!isExpanded ? group.label : undefined}
        className={clsx(
          "w-full flex items-center px-3 py-2 rounded-lg text-sm transition-all",
          isExpanded ? "gap-3" : "justify-center",
          isActive ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        )}
      >
        <Icon size={16} className={isActive ? "text-blue-600" : "text-slate-400"} />
        {isExpanded && <span className="flex-1 text-left text-[13px]">{group.label}</span>}
        {isExpanded && <ChevronDown size={12} className={clsx("text-slate-400 transition-transform duration-200", open && "rotate-180")} />}
      </button>
      {isExpanded && open && (
        <div className="ml-3.5 mt-0.5 border-l border-slate-200 pl-2.5 space-y-0.5">
          {group.items.map(({ href, label, icon: ItemIcon }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href}
                className={clsx(
                  "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all",
                  active ? "bg-blue-50/70 text-blue-700 font-semibold" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                )}
              >
                <ItemIcon size={13} className={active ? "text-blue-600" : "text-slate-400"} />
                <span className="flex-1">{label}</span>
                {active && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NavLink({ href, label, icon: Icon, badge, isExpanded }: NavItem & { badge?: number; isExpanded?: boolean }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link href={href}
      title={!isExpanded ? label : undefined}
      className={clsx(
        "flex items-center px-3 py-2 rounded-lg text-[13px] transition-all group",
        isExpanded ? "gap-3" : "justify-center relative",
        active ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      <Icon size={16} className={active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-500"} />
      {isExpanded && <span className="flex-1">{label}</span>}
      {isExpanded ? (
        badge != null && badge > 0 && (
          <span className="relative flex items-center justify-center">
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
            <span className="relative min-w-[20px] h-5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {badge > 99 ? "99+" : badge}
            </span>
          </span>
        )
      ) : (
        badge != null && badge > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
        )
      )}
      {isExpanded && active && <ChevronRight size={13} className="text-blue-600" />}
    </Link>
  );
}

export default function Sidebar({ alertCount = 0, isExpanded = true }: { alertCount?: number; isExpanded?: boolean }) {
  return (
    <nav className="p-2.5 space-y-0.5">
      <NavLink href="/dispense" label="จ่ายยา" icon={Package} isExpanded={isExpanded} />
      <NavLink href="/delivery" label="จัดส่งยา" icon={Truck} isExpanded={isExpanded} />
      
      {isExpanded ? (
        <div className="pt-2 pb-0.5 px-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">ทะเบียน & รายงาน</p>
        </div>
      ) : <div className="h-4" />}
      <CollapseGroup group={registryGroup} isExpanded={isExpanded} />
      <CollapseGroup group={reportsGroup} isExpanded={isExpanded} />
      
      {isExpanded ? (
        <div className="pt-2 pb-0.5 px-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">คลังยา</p>
        </div>
      ) : <div className="h-4" />}
      <CollapseGroup group={warehouseGroup} isExpanded={isExpanded} />
      
      {isExpanded ? (
        <div className="pt-2 pb-0.5 px-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">อื่นๆ</p>
        </div>
      ) : <div className="h-4" />}
      <NavLink href="/sticker" label="สติ๊กเกอร์ยา" icon={Tag} isExpanded={isExpanded} />
      <NavLink href="/alerts" label="แจ้งเตือน" icon={Bell} badge={alertCount} isExpanded={isExpanded} />
      <NavLink href="/settings" label="ตั้งค่า" icon={Settings} isExpanded={isExpanded} />
    </nav>
  );
}
