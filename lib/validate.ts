export function required(v: any, label: string): string | undefined {
  if (v === 0 || v === '' || v === null || v === undefined || (typeof v === 'string' && !v.trim())) {
    return `กรุณาระบุ${label}`;
  }
}

export function phone(v: string): string | undefined {
  if (!v) return;
  if (!/^0\d{8,9}$/.test(v.replace(/[-\s]/g, ''))) {
    return 'เบอร์โทรไม่ถูกต้อง (ตัวอย่าง: 0812345678)';
  }
}

export function positiveNumber(v: any, label: string): string | undefined {
  if (!v || Number(v) <= 0) return `กรุณาระบุ${label}ให้มากกว่า 0`;
}

export function notFutureDate(v: string, label: string): string | undefined {
  if (!v) return;
  if (new Date(v) > new Date()) return `${label}ต้องไม่เกินวันปัจจุบัน`;
}
