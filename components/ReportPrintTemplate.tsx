import React from 'react';

interface PrintColumn {
  label: string;
  key: string;
  render?: (row: any) => React.ReactNode;
}

interface SummaryItem {
  label: string;
  value: string | number;
}

interface ReportPrintTemplateProps {
  title: string;
  dateRange?: string;
  columns: PrintColumn[];
  data: any[];
  summaryItems?: SummaryItem[];
  userName?: string;
}

const TEAL = '#0f766e';

const S = {
  page: {
    fontFamily: '"Sarabun","Noto Sans Thai",sans-serif',
    color: '#111827',
    background: '#fff',
    padding: '1.2cm 1.5cm',
    width: '210mm',
    minHeight: '297mm', // using minHeight to allow multi-page
    boxSizing: 'border-box',
    margin: '0 auto',
    fontSize: '13px',
    lineHeight: '1.6',
    display: 'flex',
    flexDirection: 'column',
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: '14px',
    fontWeight: 700,
    borderBottom: `2px solid ${TEAL}`,
    paddingBottom: '4px',
    marginBottom: '10px',
    marginTop: '18px',
    color: '#111827',
  } as React.CSSProperties,

  th: {
    padding: '8px',
    borderBottom: `2px solid ${TEAL}`,
    textAlign: 'left',
    fontWeight: 700,
    fontSize: '12px',
    color: '#111827',
  } as React.CSSProperties,

  td: {
    padding: '6px 8px',
    borderBottom: '1px solid #e5e7eb',
    fontSize: '12px',
    color: '#374151',
  } as React.CSSProperties,

  infoBox: {
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    padding: '12px 16px',
    background: '#f9fafb',
    marginBottom: '14px',
    display: 'flex',
    gap: '20px',
  } as React.CSSProperties,
};

export default function ReportPrintTemplate({ title, dateRange, columns, data, summaryItems, userName }: ReportPrintTemplateProps) {
  return (
    <div style={S.page}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTu7nMhqiZLkgWSeS8Y1-Mbs0ILsrgt1S0HRA&s"
            alt="logo"
            style={{ width: '56px', height: '56px', objectFit: 'contain' }}
          />
          <div>
            <p style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>โรงพยาบาลวัดห้วยปลากั้งเพื่อสังคม</p>
            <p style={{ fontSize: '12px', margin: 0, color: '#4b5563' }}>แผนกชีวาภิบาล (ห้องคลังยาย่อย)</p>
            <p style={{ fontSize: '11px', margin: '2px 0 0', color: '#6b7280' }}>เลขที่ 553/11 หมู่ 14 ตำบลริมกก อำเภอเมืองเชียงราย จังหวัดเชียงราย 57100</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px' }}>รายงานระบบคลังยา</p>
          <p suppressHydrationWarning style={{ fontSize: '11px', margin: 0, color: '#6b7280' }}>
            วันที่พิมพ์: {new Date().toLocaleDateString('th-TH')} เวลา {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
          </p>
        </div>
      </div>

      {/* ── TITLE ── */}
      <h1 style={{ textAlign: 'center', fontSize: '19px', fontWeight: 700, margin: '16px 0 4px', letterSpacing: '0.03em' }}>
        {title}
      </h1>
      {dateRange && (
        <p style={{ textAlign: 'center', fontSize: '13px', margin: '0 0 20px', color: '#4b5563' }}>
          {dateRange}
        </p>
      )}

      {/* ── SUMMARY ── */}
      {summaryItems && summaryItems.length > 0 && (
        <>
          <p style={S.sectionTitle}>สรุปข้อมูล</p>
          <div style={S.infoBox}>
            {summaryItems.map((item, idx) => (
              <div key={idx} style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{item.label}</p>
                <p style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: 700, color: '#111827' }}>{item.value}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── DATA TABLE ── */}
      <p style={S.sectionTitle}>รายละเอียดรายการ</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} style={S.th}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data && data.length > 0 ? (
            data.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {columns.map((col, colIdx) => (
                  <td key={colIdx} style={S.td}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} style={{ ...S.td, textAlign: 'center', color: '#9ca3af', padding: '20px' }}>
                ไม่มีข้อมูล
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* spacer pushes signature to bottom */}
      <div style={{ flex: 1 }} />

      {/* ── SIGNATURE ── */}
      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '40px', pageBreakInside: 'avoid' }}>
        {(['ผู้รายงาน', 'ผู้ตรวจสอบ'] as const).map((role, idx) => (
          <div key={role} style={{ textAlign: 'center', fontSize: '13px' }}>
            <p style={{ marginBottom: '6px' }}>(ลงชื่อ)..................................................{role}</p>
            <p style={{ marginBottom: '6px' }}>
              {idx === 0 && userName
                ? `(..........${userName}..........)`
                : '(..................................................)'}
            </p>
            <p style={{ margin: 0 }}>วันที่........./........./.........</p>
          </div>
        ))}
      </div>

      {/* ── NOTE ── */}
      <p style={{ margin: '15px 0 0', textAlign: 'right', fontSize: '10px', color: '#9ca3af', fontStyle: 'italic', pageBreakInside: 'avoid' }}>
        หมายเหตุ: เอกสารนี้ถูกสร้างจากระบบอิเล็กทรอนิกส์
      </p>
    </div>
  );
}
