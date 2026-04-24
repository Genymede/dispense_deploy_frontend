'use client';
/**
 * RegistryDrawer — wrapper รอบ DetailDrawer
 * รับ field definitions เพื่อ render DrawerGrid อัตโนมัติ
 * ใช้ง่าย ไม่ต้องเขียน JSX ซับซ้อน
 */
import React from 'react';
import DetailDrawer, { DrawerSection, DrawerGrid } from './DetailDrawer';
import { Badge, Button } from './ui';
import { fmtDate } from '@/lib/dateUtils';

export type FieldType =
  | 'text' | 'date' | 'datetime' | 'badge_sev' | 'badge_status'
  | 'number' | 'boolean' | 'patient' | 'drug' | 'template';

export interface DrawerField {
  label: string;
  key: string;               // key ใน row object
  type?: FieldType;          // default: text
  span?: boolean;
  /** สำหรับ type=template: function รับ row คืน string */
  template?: (row: any) => string;
  /** สำหรับ badge_status: map สถานะ */
  statusMap?: Record<string, { label: string; variant: 'success'|'warning'|'danger'|'gray'|'info' }>;
  /** สำหรับ badge_sev: ใช้ key นี้เป็น severity */
  sevKey?: string;
}

const SEV_V: Record<string, 'danger'|'warning'|'gray'> = {
  severe: 'danger', moderate: 'warning', mild: 'gray',
};

const safeDate = (val: any, withTime = false) => fmtDate(val, withTime);

function renderField(row: any, field: DrawerField) {
  const val = row?.[field.key];
  switch (field.type) {
    case 'date':     return safeDate(val, false);
    case 'datetime': return safeDate(val, true);
    case 'badge_sev': {
      const sev = row?.[field.sevKey ?? field.key] ?? val;
      return <Badge variant={SEV_V[sev] ?? 'gray'}>{sev || '—'}</Badge>;
    }
    case 'badge_status': {
      if (!field.statusMap) return String(val ?? '—');
      const cfg = field.statusMap[val] ?? { label: val, variant: 'gray' as const };
      return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
    }
    case 'patient':
      return <><p className="font-medium">{row?.patient_name ?? val ?? '—'}</p><p className="text-xs text-slate-400">HN: {row?.hn_number ?? '—'}</p></>;
    case 'drug':
      return <><p className="font-medium">{row?.med_name ?? val ?? '—'}</p><p className="text-xs text-slate-400">{row?.med_generic_name ?? ''}</p></>;
    case 'boolean': return val ? 'ใช่' : 'ไม่ใช่';
    case 'number':  return val != null ? Number(val).toLocaleString() : '—';
    case 'template':
      return field.template ? field.template(row) : '—';
    default: return val != null && val !== '' ? String(val) : '—';
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
  row: any | null;
  title: string | ((row: any) => string);
  subtitle?: string | ((row: any) => string);
  fields: DrawerField[];
  onEdit?: (row: any) => void;
  extraActions?: (row: any) => React.ReactNode;
  width?: 'sm' | 'md' | 'lg';
}

export default function RegistryDrawer({
  open, onClose, row, title, subtitle, fields, onEdit, extraActions, width = 'md',
}: Props) {
  const t = row ? (typeof title === 'function' ? title(row) : title) : '';
  const s = row ? (typeof subtitle === 'function' ? subtitle(row) : subtitle) : '';

  return (
    <DetailDrawer open={open} onClose={onClose} title={t} subtitle={s} width={width}>
      {row && (
        <>
          <DrawerSection title="รายละเอียด">
            <DrawerGrid
              items={fields.map(f => ({
                label: f.label,
                value: renderField(row, f),
                span: f.span,
              }))}
            />
          </DrawerSection>
          {(onEdit || extraActions) && (
            <DrawerSection title="">
              <div className="flex gap-2">
                {onEdit && (
                  <Button variant="secondary" onClick={() => { onClose(); onEdit(row); }}>
                    แก้ไข
                  </Button>
                )}
                {extraActions?.(row)}
              </div>
            </DrawerSection>
          )}
        </>
      )}
    </DetailDrawer>
  );
}
