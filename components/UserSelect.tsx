'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface UserOption { id: string; email: string; full_name: string; role_name_th: string; }

interface Props {
  label?: string;
  value?: string | null;
  onChange: (id: string | null, email: string) => void;
  required?: boolean;
  placeholder?: string;
  defaultToCurrentUser?: boolean;
  roleId?: number;
}

export default function UserSelect({
  label = 'ผู้ดำเนินการ', value, onChange,
  required, placeholder = 'เลือกผู้ใช้', defaultToCurrentUser = true, roleId,
}: Props) {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<UserOption[]>('/auth/users', { params: roleId ? { role_id: roleId } : {} })
      .then(r => {
        setUsers(r.data);
        if (defaultToCurrentUser && !value && user) {
          onChange(user.id, user.email);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (defaultToCurrentUser && !value && user && users.length > 0) {
      onChange(user.id, user.email);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, users]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value || null;
    const found = users.find(u => u.id === id);
    onChange(id, found?.email ?? '');
  };

  const selected = value ?? (user?.id ?? '');

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-slate-700">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        value={selected}
        onChange={handleChange}
        disabled={loading}
        className="w-full h-9 rounded-lg border border-slate-200 text-sm bg-white text-slate-800 px-3 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-colors"
      >
        <option value="">{loading ? 'กำลังโหลด...' : placeholder}</option>
        {users.map(u => (
          <option key={u.id} value={u.id}>
            {u.full_name} ({u.role_name_th})
          </option>
        ))}
      </select>
    </div>
  );
}
