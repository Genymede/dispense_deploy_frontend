import { drugApi, type StockLot } from './api';
import toast from 'react-hot-toast';
import React from 'react';

export async function validateDrugLots(
  med_sid: number, 
  med_name: string, 
  requiredQty: number = 1,
  silent: boolean = false
): Promise<{ ok: boolean; available: number; logs: string[] }> {
  try {
    const lotRes = await drugApi.getLots(med_sid);
    const lots = lotRes.data ?? [];
    
    if (lots.length === 0) {
      if (!silent) toast.error(`ยา "${med_name}" ไม่มีข้อมูลล็อตยาในระบบ`);
      return { ok: false, available: 0, logs: ['ไม่มีข้อมูลล็อตยา'] };
    }

    // เรียงวันหมดอายุจากใกล้สุดไปไกลสุด (null อยู่ท้ายสุด - ถือว่ายังไม่หมดอายุหรือไม่มีวันระบุ)
    const sortedLots = [...lots].sort((a, b) => {
      if (!a.exp_date) return 1;
      if (!b.exp_date) return -1;
      return new Date(a.exp_date).getTime() - new Date(b.exp_date).getTime();
    });

    const now = new Date();
    now.setHours(0, 0, 0, 0); // ตรวจสอบแค่วันที่

    let totalValidStock = 0;
    let foundValid = false;
    let expiredLogs: string[] = [];

    for (let i = 0; i < sortedLots.length; i++) {
      const lot = sortedLots[i];
      const isExpired = lot.exp_date && new Date(lot.exp_date) < now;
      const lotLabel = lot.lot_number ? `ล็อต ${lot.lot_number}` : `ล็อตที่ ${i + 1}`;
      
      if (isExpired) {
        const expStr = new Date(lot.exp_date!).toLocaleDateString('th-TH');
        expiredLogs.push(`${lotLabel} หมดอายุเมื่อ ${expStr}`);
      } else {
        foundValid = true;
        totalValidStock += lot.quantity;
      }
    }

    // ถ้าไม่เจอล็อตที่ใช้งานได้เลย (หมดอายุทุกล็อต)
    if (!foundValid) {
      if (!silent) {
        toast.error(
          React.createElement('div', null, [
            React.createElement('p', { className: 'font-bold mb-1', key: 'title' }, `ไม่สามารถเลือกยา "${med_name}" ได้`),
            ...expiredLogs.map((log, idx) => 
              React.createElement('p', { className: 'text-[10px] text-red-500 leading-tight', key: idx }, `• ${log} (ตรวจสอบล็อตถัดไป...)`)
            ),
            React.createElement('p', { className: 'mt-1 text-xs font-semibold text-red-700 border-t pt-1', key: 'summary' }, 'สรุป: ยาหมดอายุทุกล็อต')
          ]),
          { duration: 6000 }
        );
      }
      return { ok: false, available: 0, logs: expiredLogs };
    }

    // ถ้าสต็อกที่ยังไม่หมดอายุไม่พอ
    if (totalValidStock < requiredQty && !silent) {
      toast.error(`ยา "${med_name}" มีสต็อกที่ยังไม่หมดอายุเพียง ${totalValidStock} (ต้องการ ${requiredQty})`);
      return { ok: false, available: totalValidStock, logs: [] };
    }

    return { ok: true, available: totalValidStock, logs: [] };
  } catch (error: any) {
    if (!silent) toast.error(`เกิดข้อผิดพลาดในการตรวจสอบล็อตยา: ${error.message}`);
    return { ok: false, available: 0, logs: [error.message] };
  }
}
