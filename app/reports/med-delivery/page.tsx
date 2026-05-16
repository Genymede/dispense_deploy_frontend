'use client';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { Badge } from '@/components/ui';
import { extraReportApi } from '@/lib/api';
import { fmtDate } from '@/lib/dateUtils';
import { Truck } from 'lucide-react';

const STATUS_LABEL: Record<string,string> = {
  Delivered: 'ส่งแล้ว', Cancelled: 'ยกเลิก', Processing: 'กำลังส่ง', Pending: 'รอดำเนินการ',
};
const STATUS_COLOR: Record<string,string> = {
  Delivered: '#16a34a', Cancelled: '#dc2626', Processing: '#2563eb', Pending: '#d97706',
};
const STATUS_BG: Record<string,string> = {
  Delivered: '#f0fdf4', Cancelled: '#fef2f2', Processing: '#eff6ff', Pending: '#fffbeb',
};
const STATUS_VARIANT: Record<string,string> = {
  Delivered: 'success', Cancelled: 'danger', Processing: 'info', Pending: 'warning',
};

const TEAL = '#006fc6';

const S: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: '"Sarabun","Noto Sans Thai",sans-serif',
    color: '#111827', background: '#fff',
    padding: '1.2cm 1.5cm', width: '210mm',
    boxSizing: 'border-box', margin: '0 auto',
    fontSize: '13px', lineHeight: '1.6',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid #e5e7eb',
  },
  title: { textAlign: 'center', fontSize: '18px', fontWeight: 700, margin: '12px 0 20px' },
  card: {
    border: '1px solid #e2e8f0', borderRadius: '8px',
    marginBottom: '16px', overflow: 'hidden',
    pageBreakInside: 'avoid',
  },
  cardHead: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 14px', background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
  },
  cardBody: { padding: '10px 14px' },
  infoGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: '4px 20px', marginBottom: '10px',
  },
  infoItem: { display: 'flex', gap: '6px', fontSize: '12px' },
  label: { color: '#6b7280', minWidth: '80px', flexShrink: 0 },
  value: { color: '#111827', fontWeight: 500 },
  subTable: { width: '100%', borderCollapse: 'collapse', marginTop: '8px' },
  subTh: {
    padding: '5px 8px', background: '#f1f5f9',
    fontSize: '11px', color: '#475569', fontWeight: 600,
    textAlign: 'left', borderBottom: '1px solid #e2e8f0',
  },
  subTd: { padding: '5px 8px', fontSize: '12px', borderBottom: '1px solid #f1f5f9' },
  badge: (status: string): React.CSSProperties => ({
    display: 'inline-block', padding: '2px 10px', borderRadius: '999px',
    fontSize: '11px', fontWeight: 600,
    color: STATUS_COLOR[status] ?? '#92400e',
    background: STATUS_BG[status] ?? '#fffbeb',
    border: `1px solid ${STATUS_COLOR[status] ?? '#d97706'}33`,
  }),
};

function DeliveryPrintLayout({ data }: { data: any[] }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTu7nMhqiZLkgWSeS8Y1-Mbs0ILsrgt1S0HRA&s"
            alt="logo" style={{ width: '52px', height: '52px', objectFit: 'contain' }}
          />
          <div>
            <p style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>โรงพยาบาลวัดห้วยปลากั้งเพื่อสังคม</p>
            <p style={{ fontSize: '11px', margin: '2px 0 0', color: '#4b5563' }}>แผนกจ่ายยาและคลังยาย่อย</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 2px' }}>รายงานระบบคลังยา</p>
          <p style={{ fontSize: '11px', margin: 0, color: '#6b7280' }}>พิมพ์: {dateStr} เวลา {timeStr} น.</p>
        </div>
      </div>

      <h1 style={S.title as React.CSSProperties}>รายงานการจัดส่งยา</h1>

      {/* Summary bar */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '18px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>รายการทั้งหมด</p>
          <p style={{ margin: '2px 0 0', fontSize: '20px', fontWeight: 700, color: TEAL }}>{data.length}</p>
        </div>
        {(['Delivered','Processing','Pending','Cancelled'] as const).map(s => {
          const count = data.filter(r => r.status === s).length;
          if (!count) return null;
          return (
            <div key={s} style={{ flex: 1, textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>{STATUS_LABEL[s]}</p>
              <p style={{ margin: '2px 0 0', fontSize: '20px', fontWeight: 700, color: STATUS_COLOR[s] }}>{count}</p>
            </div>
          );
        })}
      </div>

      {/* Delivery cards */}
      {data.map((r, idx) => {
        const meds: any[] = Array.isArray(r.medicine_list) ? r.medicine_list : [];
        const totalCost = Number(r.total_cost);
        return (
          <div key={idx} style={S.card}>
            {/* Card header */}
            <div style={S.cardHead}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700 }}>{r.patient_name ?? '-'}</span>
                <span style={{ fontSize: '11px', color: '#6b7280' }}>HN: {r.hn_number ?? '-'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '11px', color: '#6b7280' }}>{fmtDate(r.delivery_date)}</span>
                <span style={S.badge(r.status)}>{STATUS_LABEL[r.status] ?? r.status}</span>
              </div>
            </div>

            <div style={S.cardBody}>
              {/* Info grid */}
              <div style={S.infoGrid}>
                <div style={S.infoItem}>
                  <span style={S.label}>ผู้รับ</span>
                  <span style={S.value}>{r.receiver_name ?? '-'}</span>
                </div>
                <div style={S.infoItem}>
                  <span style={S.label}>วิธีส่ง</span>
                  <span style={S.value}>{r.delivery_method ?? '-'}</span>
                </div>
                <div style={S.infoItem}>
                  <span style={S.label}>เบอร์โทร</span>
                  <span style={S.value}>{r.receiver_phone ?? '-'}</span>
                </div>
                <div style={S.infoItem}>
                  <span style={S.label}>เลขพัสดุ</span>
                  <span style={{ ...S.value, fontFamily: 'monospace' }}>{r.tracking_number ?? '-'}</span>
                </div>
                <div style={{ ...S.infoItem, gridColumn: '1 / -1' }}>
                  <span style={S.label}>ที่อยู่</span>
                  <span style={S.value}>{r.address ?? '-'}</span>
                </div>
                {r.courier_name && (
                  <div style={S.infoItem}>
                    <span style={S.label}>ผู้จัดส่ง</span>
                    <span style={S.value}>{r.courier_name}</span>
                  </div>
                )}
                {r.note && (
                  <div style={{ ...S.infoItem, gridColumn: '1 / -1' }}>
                    <span style={S.label}>หมายเหตุ</span>
                    <span style={{ ...S.value, color: '#6b7280' }}>{r.note}</span>
                  </div>
                )}
              </div>

              {/* Medicine sub-table */}
              {meds.length > 0 && (
                <>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: '#475569', margin: '8px 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    รายการยา ({meds.length} รายการ)
                  </p>
                  <table style={S.subTable}>
                    <thead>
                      <tr>
                        <th style={S.subTh}>#</th>
                        <th style={S.subTh}>ชื่อยา</th>
                        <th style={S.subTh}>วิธีใช้</th>
                        <th style={{ ...S.subTh, textAlign: 'center' }}>จำนวน</th>
                        <th style={{ ...S.subTh, textAlign: 'right' }}>ราคา (บาท)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meds.map((m: any, i: number) => {
                        const mealStr = m.meal_sessions ? m.meal_sessions.split(',').filter(Boolean).join(' ') : '';
                        const usage = [m.route, m.dose_qty ? `ครั้งละ ${m.dose_qty} ${m.dose_unit||''}` : '', m.frequency, m.meal_relation, mealStr].filter(Boolean).join(' ');
                        const lineTotal = Number(m.unit_price) > 0 ? (Number(m.unit_price) * m.quantity).toFixed(2) : null;
                        return (
                          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                            <td style={{ ...S.subTd, color: '#9ca3af', width: '24px', textAlign: 'center' }}>{i + 1}</td>
                            <td style={S.subTd}>
                              <p style={{ margin: 0, fontWeight: 600 }}>{m.med_showname || m.med_name}</p>
                            </td>
                            <td style={{ ...S.subTd, color: '#6b7280', fontSize: '11px' }}>{usage || '-'}</td>
                            <td style={{ ...S.subTd, textAlign: 'center', fontWeight: 600 }}>
                              {m.quantity} <span style={{ color: '#9ca3af', fontWeight: 400 }}>{m.unit || ''}</span>
                            </td>
                            <td style={{ ...S.subTd, textAlign: 'right' }}>{lineTotal ?? <span style={{ color: '#d1d5db' }}>—</span>}</td>
                          </tr>
                        );
                      })}
                      {totalCost > 0 && (
                        <tr>
                          <td colSpan={4} style={{ ...S.subTd, textAlign: 'right', fontWeight: 600, color: '#374151', borderTop: `1px solid ${TEAL}33` }}>รวมทั้งหมด</td>
                          <td style={{ ...S.subTd, textAlign: 'right', fontWeight: 700, color: TEAL, borderTop: `1px solid ${TEAL}33` }}>{totalCost.toFixed(2)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        );
      })}

      {/* Signature */}
      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '40px', pageBreakInside: 'avoid' }}>
        {(['ผู้รายงาน', 'ผู้ตรวจสอบ'] as const).map(role => (
          <div key={role} style={{ textAlign: 'center', fontSize: '13px' }}>
            <p style={{ marginBottom: '6px' }}>(ลงชื่อ)..................................................{role}</p>
            <p style={{ marginBottom: '6px' }}>(.................................................)</p>
            <p style={{ margin: 0 }}>วันที่........./........./.........</p>
          </div>
        ))}
      </div>

      <p style={{ margin: '15px 0 0', textAlign: 'right', fontSize: '10px', color: '#9ca3af', fontStyle: 'italic' }}>
        หมายเหตุ: เอกสารนี้ถูกสร้างจากระบบอิเล็กทรอนิกส์
      </p>
    </div>
  );
}

const COLS: ColDef[] = [
  { key:'patient_name', label:'ผู้ป่วย',
    render: r => <><p className="font-medium">{r.patient_name??'-'}</p><p className="text-xs text-slate-400">HN: {r.hn_number??'-'}</p></>,
    exportValue: r => `${r.patient_name??'-'} (HN: ${r.hn_number??'-'})` },
  { key:'receiver_name', label:'ผู้รับ', className:'text-sm',
    render: r => r.receiver_name ?? <span className="text-slate-300">—</span>,
    exportValue: r => r.receiver_name??'-' },
  { key:'delivery_method', label:'วิธีส่ง', className:'text-xs' },
  { key:'medicine_list', label:'รายการยา',
    render: r => {
      const list = Array.isArray(r.medicine_list) ? r.medicine_list : [];
      if (!list.length) return <span className="text-slate-300">—</span>;
      return (
        <div>
          <p className="text-xs font-medium text-slate-700">{list.length} รายการ</p>
          <p className="text-xs text-slate-400 truncate max-w-[200px]">
            {list.map((m:any) => m.med_showname||m.med_name).join(', ')}
          </p>
        </div>
      );
    },
    exportValue: r => {
      const list = Array.isArray(r.medicine_list) ? r.medicine_list : [];
      return list.map((m:any) => `${m.med_showname||m.med_name} x${m.quantity}${m.unit||''}`).join(' | ');
    }
  },
  { key:'tracking_number', label:'เลขพัสดุ', className:'text-xs font-mono',
    render: r => r.tracking_number ?? <span className="text-slate-300">—</span>,
    exportValue: r => r.tracking_number??'-' },
  { key:'status', label:'สถานะ',
    render: r => <Badge variant={(STATUS_VARIANT[r.status]??'warning') as any}>{STATUS_LABEL[r.status]??r.status}</Badge>,
    exportValue: r => STATUS_LABEL[r.status]??r.status },
  { key:'delivery_date', label:'วันที่',
    render: r => fmtDate(r.delivery_date),
    exportValue: r => fmtDate(r.delivery_date) },
  { key:'receiver_phone',  label:'เบอร์โทรผู้รับ',  exportOnly: true, exportValue: r => r.receiver_phone??'-' },
  { key:'address',         label:'ที่อยู่จัดส่ง',   exportOnly: true, exportValue: r => r.address??'-' },
  { key:'courier_name',    label:'ผู้จัดส่ง',        exportOnly: true, exportValue: r => r.courier_name??'-' },
  { key:'total_cost',      label:'ยอดรวม (บาท)',     exportOnly: true, exportValue: r => Number(r.total_cost)>0 ? Number(r.total_cost).toFixed(2) : '-' },
];

export default function MedDeliveryPage() {
  return (
    <MainLayout title="รายงานการจัดส่งยา" subtitle="Medication Delivery Report">
      <DataTable cols={COLS}
        fetcher={p => extraReportApi.getMedDelivery(p).then((r:any) => ({ data:r.data.data??r.data, total:r.data.total??0 }))}
        filters={[
          { key:'search', type:'search', placeholder:'ค้นหาชื่อผู้ป่วย...' },
          { key:'status', type:'select', placeholder:'ทุกสถานะ',
            options:[{value:'Pending',label:'รอ'},{value:'Delivered',label:'ส่งแล้ว'},{value:'Cancelled',label:'ยกเลิก'}] },
          { key:'date_from', type:'date', placeholder:'จากวันที่' },
          { key:'date_to',   type:'date', placeholder:'ถึงวันที่' },
        ]}
        exportTitle="รายงานการจัดส่งยา"
        printTemplate={data => <DeliveryPrintLayout data={data} />}
        emptyIcon={<Truck size={36}/>} emptyText="ไม่พบรายการ"
        deps={[]} />
    </MainLayout>
  );
}
