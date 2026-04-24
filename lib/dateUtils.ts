/**
 * วันที่ปัจจุบันในรูป YYYY-MM-DD (timezone ไทย UTC+7)
 * ใช้แทน new Date().toISOString().split('T')[0] ซึ่งให้วันที่ UTC
 */
export function thaiToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
}

/**
 * วันที่ย้อนหลัง n วัน (timezone ไทย) ในรูป YYYY-MM-DD
 */
export function thaiDaysAgo(n: number): string {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
}

/**
 * Normalize timestamp string จาก pg driver เป็น valid ISO 8601
 * "2024-01-15 10:00:00+07"   → "2024-01-15T10:00:00+07:00"
 * "2024-01-15T03:00:00.000Z" → ไม่เปลี่ยน
 */
function toIso(val: any): Date | null {
  if (!val) return null;
  try {
    let s = String(val).trim();
    s = s.replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T');          // space → T
    s = s.replace(/([+-])(\d{2})$/, '$1$2:00');              // +07 → +07:00
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}

/**
 * Format timestamp จาก DB เป็นวันที่ภาษาไทย timezone ไทย (UTC+7)
 * @param val      timestamp string จาก DB (timestamptz)
 * @param withTime true = แสดงเวลา HH:mm ด้วย
 */
export function fmtDate(val: any, withTime = false): string {
  const d = toIso(val);
  if (!d) return '—';
  return new Intl.DateTimeFormat('th-TH-u-ca-gregory', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  }).format(d);
}

/**
 * Format date สำหรับ label แกน chart (แสดงเฉพาะ วัน+เดือน ไม่มีปี)
 */
export function fmtDateLabel(val: any): string {
  const d = toIso(val);
  if (!d) return String(val ?? '');
  return new Intl.DateTimeFormat('th-TH-u-ca-gregory', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric', month: 'short',
  }).format(d);
}
