'use client';
import { ReactNode, useState } from 'react';
import { Modal, Button, ConfirmDialog } from './ui';
import { Trash2, Edit2, Plus, Eye } from 'lucide-react';

export function FormGrid({ children, cols = 2 }: { children: ReactNode; cols?: 1 | 2 | 3 }) {
  const cls = { 1: 'grid-cols-1', 2: 'grid-cols-1 sm:grid-cols-2', 3: 'grid-cols-1 sm:grid-cols-3' };
  return <div className={`grid ${cls[cols]} gap-4`}>{children}</div>;
}

export function FormSpan({ children }: { children: ReactNode }) {
  return <div className="sm:col-span-2">{children}</div>;
}

interface CrudModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  editingId?: number | string | null;
  onSave: () => void;
  saving?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: ReactNode;
}

export function CrudModal({ open, onClose, title, editingId, onSave, saving, size = 'lg', children }: CrudModalProps) {
  return (
    <Modal open={open} onClose={onClose}
      title={editingId ? `แก้ไข${title}` : `เพิ่ม${title}ใหม่`}
      size={size}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>ยกเลิก</Button>
          <Button onClick={onSave} loading={saving} icon={editingId ? <Edit2 size={14} /> : <Plus size={14} />}>
            {editingId ? 'บันทึกการแก้ไข' : 'เพิ่ม'}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}

export function RowActions({
  onView, onEdit, onDelete, canDelete = true, deleteMessage,
}: {
  onView?: () => void;
  onEdit: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
  deleteMessage?: string;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  return (
    <>
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        {onView && (
          <button onClick={onView}
            className="p-1.5 rounded-lg hover:bg-primary-50 text-slate-400 hover:text-primary-600 transition-colors" title="ดูรายละเอียด">
            <Eye size={14} />
          </button>
        )}
        <button onClick={onEdit}
          className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors" title="แก้ไข">
          <Edit2 size={14} />
        </button>
        {onDelete && canDelete && (
          <button onClick={() => setShowConfirm(true)}
            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" title="ลบ">
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <ConfirmDialog
        open={showConfirm}
        title="ยืนยันการลบ"
        message={deleteMessage ?? 'รายการที่ลบแล้วไม่สามารถกู้คืนได้'}
        confirmLabel="ลบ"
        onConfirm={() => { setShowConfirm(false); onDelete?.(); }}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
