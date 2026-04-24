'use client';
import { useEffect, useState, useCallback } from 'react';
import MainLayout from '@/components/MainLayout';
import { Card, Button, Badge, Spinner } from '@/components/ui';
import { printerApi, type Printer } from '@/lib/api';
import { Printer as PrinterIcon, RefreshCw, Send, Tag, Server, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const STORAGE_KEY = 'selected_printer_name';

export default function StickerPage() {
  const [printers, setPrinters]                   = useState<Printer[]>([]);
  const [loadingPrinters, setLoadingPrinters]     = useState(false);
  const [selectedName, setSelectedName]           = useState('');
  const [printerName, setPrinterName]             = useState('');
  const [textToPrint, setTextToPrint]             = useState('Hello');
  const [printing, setPrinting]                   = useState(false);

  const fetchPrinters = useCallback(async () => {
    setLoadingPrinters(true);
    try {
      const res = await printerApi.getPrinters();
      const list = res.data;
      setPrinters(list);

      const stored = localStorage.getItem(STORAGE_KEY);
      const match  = stored && list.find((p) => p.Name === stored);
      if (match) {
        setSelectedName(match.Name);
      } else if (list.length > 0) {
        setSelectedName(list[0].Name);
      }
    } catch (err: any) {
      toast.error(err.message || 'ดึงรายชื่อเครื่องพิมพ์ไม่สำเร็จ');
      setPrinters([]);
    } finally {
      setLoadingPrinters(false);
    }
  }, []);

  useEffect(() => { fetchPrinters(); }, [fetchPrinters]);

  useEffect(() => {
    if (!selectedName) return;
    localStorage.setItem(STORAGE_KEY, selectedName);
    setPrinterName(selectedName);
  }, [selectedName]);

  const handlePrint = async () => {
    if (!selectedName || !textToPrint) {
      toast.error('กรุณาเลือกเครื่องพิมพ์และใส่ข้อความ');
      return;
    }
    setPrinting(true);
    try {
      await printerApi.print(textToPrint, selectedName);
      toast.success('พิมพ์สำเร็จ');
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการพิมพ์');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <MainLayout
      title="สติ๊กเกอร์ยา"
      subtitle="จัดการและทดสอบการพิมพ์สติ๊กเกอร์ฉลากยา"
      actions={
        <Button
          icon={<Send size={14} />}
          onClick={handlePrint}
          loading={printing}
          disabled={!selectedName || !textToPrint}
        >
          ส่งคำสั่งพิมพ์
        </Button>
      }
    >
      <div className="max-w-2xl space-y-5">

        {/* สถานะเครื่องพิมพ์ */}
        <Card>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${printerName ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-500'}`}>
              {printerName ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-700">
                {printerName ? `เชื่อมต่อกับ: ${printerName}` : 'ยังไม่ได้เลือกเครื่องพิมพ์'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {printerName ? `Printer: ${selectedName}` : 'เลือกเครื่องพิมพ์จากรายการด้านล่าง'}
              </p>
            </div>
            <Badge variant={printerName ? 'success' : 'warning'} dot>
              {printerName ? 'พร้อมพิมพ์' : 'ไม่พร้อม'}
            </Badge>
          </div>
        </Card>

        {/* เลือกเครื่องพิมพ์ */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Server size={14} /> เลือกเครื่องพิมพ์ปลายทาง
            </h3>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={13} className={loadingPrinters ? 'animate-spin' : ''} />}
              onClick={fetchPrinters}
              loading={loadingPrinters}
            >
              รีเฟรช
            </Button>
          </div>

          {loadingPrinters ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : printers.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">ไม่พบเครื่องพิมพ์บนเครือข่าย</p>
          ) : (
            <div className="space-y-2">
              {printers.map((p, i) => (
                <label key={i}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedName === p.Name
                      ? 'border-primary-300 bg-primary-50'
                      : 'border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="printer"
                    value={p.Name}
                    checked={selectedName === p.Name}
                    onChange={() => setSelectedName(p.Name)}
                    className="text-primary-600"
                  />
                  <PrinterIcon size={15} className="text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{p.Name}</p>
                    <p className="text-xs text-slate-400 font-mono">
                      {p.PortName ?? '—'} · {p.DriverName ?? '—'}
                    </p>
                  </div>
                  <Badge variant={p.Status === 'OK' ? 'success' : 'warning'}>
                    {p.Status ?? `Status ${p.PrinterStatus}`}
                  </Badge>
                </label>
              ))}
            </div>
          )}
        </Card>

        {/* ทดสอบพิมพ์ */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
            <Tag size={14} /> ทดสอบการพิมพ์ข้อความ
          </h3>
          <textarea
            value={textToPrint}
            onChange={(e) => setTextToPrint(e.target.value)}
            placeholder="ป้อนข้อความสำหรับทดสอบการพิมพ์ (หลายบรรทัดได้)"
            rows={5}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 transition"
          />
          <p className="text-xs text-slate-400 mt-2">
            * ขนาดสติ๊กเกอร์ 60×60 มม. · ใช้ภาษาอังกฤษ/ตัวเลข (TSPL font ในตัวเครื่อง)
          </p>
        </Card>

      </div>
    </MainLayout>
  );
}
