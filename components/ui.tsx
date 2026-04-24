"use client";
import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { Loader2, X } from "lucide-react";

// ── Button ────────────────────────────────────────────────────────────────────

type BtnVariant = "primary" | "secondary" | "danger" | "ghost" | "success" | "warning";
type BtnSize = "xs" | "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

const btnVariants: Record<BtnVariant, string> = {
  primary: "bg-primary-600 text-white hover:bg-primary-700 border-primary-600",
  secondary: "bg-white text-slate-700 hover:bg-slate-50 border-slate-200",
  danger: "bg-red-600 text-white hover:bg-red-700 border-red-600",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100 border-transparent",
  success: "bg-green-600 text-white hover:bg-green-700 border-green-600",
  warning: "bg-amber-500 text-white hover:bg-amber-600 border-amber-500",
};
const btnSizes: Record<BtnSize, string> = {
  xs: "h-7 px-2.5 text-xs gap-1",
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-10 px-5 text-base gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon,
  iconRight,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center font-medium border rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed select-none",
        btnVariants[variant],
        btnSizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
  suffix?: ReactNode;
}

export function Input({ label, error, icon, suffix, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-slate-700">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        {icon && (
          <span className="absolute left-3 text-slate-400 pointer-events-none">{icon}</span>
        )}
        <input
          className={clsx(
            "w-full h-9 rounded-lg border text-sm bg-white text-slate-800 placeholder:text-slate-400 transition-colors",
            "border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none",
            icon ? "pl-9" : "pl-3",
            suffix ? "pr-9" : "pr-3",
            error && "border-red-400 focus:border-red-500 focus:ring-red-100",
            className
          )}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 text-slate-500 text-xs">{suffix}</span>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────────────────────

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({ label, error, options, placeholder, className, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-slate-700">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        className={clsx(
          "w-full h-9 rounded-lg border text-sm bg-white text-slate-800 transition-colors px-3 outline-none",
          "border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100",
          error && "border-red-400",
          className
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────

type BadgeVariant = "success" | "warning" | "danger" | "info" | "gray" | "primary";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}

const badgeStyles: Record<BadgeVariant, string> = {
  success: "status-active",
  warning: "status-warning",
  danger: "status-danger",
  info: "status-info",
  gray: "status-gray",
  primary: "bg-primary-50 text-primary-700",
};

export function Badge({ variant = "gray", children, className, dot }: BadgeProps) {
  return (
    <span className={clsx("badge", badgeStyles[variant], className)}>
      {dot && (
        <span
          className={clsx(
            "w-1.5 h-1.5 rounded-full",
            variant === "success" && "bg-green-500",
            variant === "warning" && "bg-amber-500",
            variant === "danger" && "bg-red-500",
            variant === "info" && "bg-sky-500",
            variant === "gray" && "bg-slate-400",
            variant === "primary" && "bg-primary-500",
          )}
        />
      )}
      {children}
    </span>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  footer?: ReactNode;
}

const modalSizes = {
  sm:  "max-w-sm",
  md:  "max-w-lg",
  lg:  "max-w-2xl",
  xl:  "max-w-4xl",
  "2xl": "max-w-6xl",
};

export function Modal({ open, onClose, title, children, size = "md", footer }: ModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!open || !mounted) return null;
  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={clsx("modal-box w-full", modalSizes[size])}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && (
          <div className="px-5 pb-5 flex justify-end gap-2 border-t border-slate-100 pt-4">{footer}</div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("card p-5", className)}>{children}</div>;
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  trendUp?: boolean;
  color?: "blue" | "green" | "red" | "amber";
  onClick?: () => void;
}

const statColors = {
  blue: { bg: "bg-primary-50", icon: "text-primary-600", val: "text-primary-700" },
  green: { bg: "bg-green-50", icon: "text-green-600", val: "text-green-700" },
  red: { bg: "bg-red-50", icon: "text-red-600", val: "text-red-700" },
  amber: { bg: "bg-amber-50", icon: "text-amber-600", val: "text-amber-700" },
};

export function StatCard({ label, value, icon, trend, trendUp, color = "blue", onClick }: StatCardProps) {
  const c = statColors[color];
  return (
    <div
      className={clsx("card p-5 flex items-start gap-4", onClick && "cursor-pointer hover:border-primary-200")}
      onClick={onClick}
    >
      <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center", c.bg)}>
        <span className={c.icon}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 mb-1">{label}</p>
        <p className={clsx("text-2xl font-bold", c.val)}>{value}</p>
        {trend && (
          <p className={clsx("text-xs mt-1", trendUp ? "text-green-600" : "text-red-500")}>
            {trend}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

export function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-slate-300 mb-4">{icon}</div>
      <p className="text-slate-600 font-medium">{title}</p>
      {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
    </div>
  );
}

// ── Loading Spinner ───────────────────────────────────────────────────────────

export function Spinner({ size = 20 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin text-primary-500" />;
}

// ── Textarea ──────────────────────────────────────────────────────────────────

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-slate-700">{label}</label>}
      <textarea
        className={clsx(
          "w-full rounded-lg border text-sm bg-white text-slate-800 placeholder:text-slate-400 transition-colors p-3 outline-none resize-none",
          "border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100",
          error && "border-red-400",
          className
        )}
        rows={3}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "danger" | "warning" | "info";
  /** ถ้า true จะแสดงเฉพาะปุ่ม "ตกลง" (alert mode ไม่ถามยืนยัน) */
  alertOnly?: boolean;
}

const CONFIRM_CFG = {
  danger:  { iconBg: "bg-red-100",   icon: "text-red-500",   btn: "bg-red-600 hover:bg-red-700 focus:ring-red-300" },
  warning: { iconBg: "bg-amber-100", icon: "text-amber-500", btn: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-300" },
  info:    { iconBg: "bg-blue-100",  icon: "text-blue-500",  btn: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-300" },
};

export function ConfirmDialog({ open, title, message, confirmLabel = "ยืนยัน", cancelLabel = "ยกเลิก", onConfirm, onCancel, variant = "danger", alertOnly = false }: ConfirmDialogProps) {
  if (!open) return null;
  const cfg = CONFIRM_CFG[variant];
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 animate-fade-in"
      style={{ background: "rgba(15,23,42,0.5)" }}
      onClick={alertOnly ? onConfirm : onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-full ${cfg.iconBg} flex items-center justify-center flex-shrink-0`}>
            <svg className={`w-5 h-5 ${cfg.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <div className="flex-1 pt-0.5">
            <h3 className="text-base font-semibold text-slate-800">{title}</h3>
            {message && <p className="text-sm text-slate-500 mt-1 leading-relaxed">{message}</p>}
          </div>
        </div>
        <div className="flex gap-2.5 mt-6 justify-end">
          {!alertOnly && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              {cancelLabel}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white ${cfg.btn} rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1`}
          >
            {alertOnly ? 'ตกลง' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
