'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { queueApi } from '@/lib/api';
import { ArrowLeft, Wifi, WifiOff } from 'lucide-react';
import Link from 'next/link';

export default function QueueDisplayPage() {
  const [current, setCurrent] = useState<any | null>(null);
  const [waiting, setWaiting] = useState<any[]>([]);
  const [time, setTime] = useState('');
  const [online, setOnline] = useState(true);
  const [blink, setBlink] = useState(false);
  const prevNumber = useRef<string | null>(null);

  // Clock
  useEffect(() => {
    const tick = () => setTime(
      new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await queueApi.getDisplay();
      const { current: cur, waiting: wt } = res.data;
      if (cur?.queue_number !== prevNumber.current) {
        prevNumber.current = cur?.queue_number ?? null;
        setBlink(true);
        setTimeout(() => setBlink(false), 1500);
      }
      setCurrent(cur ?? null);
      setWaiting(wt ?? []);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5000);
    return () => clearInterval(id);
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-[#07111f] text-white flex flex-col select-none overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-white/[0.08]">
        <Link href="/queue"
          className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm transition-colors">
          <ArrowLeft size={15} /> กลับ
        </Link>
        <div className="flex items-center gap-3">
          {online
            ? <Wifi size={13} className="text-emerald-400" />
            : <WifiOff size={13} className="text-red-400 animate-pulse" />}
          <span className="font-mono text-white/30 text-sm tabular-nums">{time}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">

        {/* ── Current queue (left 2/3) ── */}
        <div className="flex-1 flex flex-col items-center justify-center px-16 py-12">

          <p className="text-white/30 text-xs uppercase tracking-[0.25em] mb-10 font-medium">
            หมายเลขคิวที่เรียก
          </p>

          {current ? (
            <div className={`text-center transition-all duration-700 ${blink ? 'scale-105' : 'scale-100'}`}>
              {/* Number */}
              <div className="relative flex items-center justify-center mb-6">
                {blink && (
                  <div className="absolute inset-0 rounded-full bg-sky-500/20 blur-[80px] animate-ping" />
                )}
                <span
                  className="font-mono font-black leading-none text-[min(22vw,180px)] tracking-tight"
                  style={{
                    background: 'linear-gradient(to bottom, #ffffff 30%, #90d5f9)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter: blink ? 'drop-shadow(0 0 40px rgba(147,210,255,0.7))' : 'drop-shadow(0 0 20px rgba(147,210,255,0.3))',
                    transition: 'filter 0.5s ease',
                  }}>
                  {current.queue_number}
                </span>
              </div>

              {/* Patient info */}
              <p className="text-2xl font-semibold text-white/90 mb-1">
                {current.patient_name || 'ผู้ป่วย'}
              </p>
              {current.hn_number && (
                <p className="text-base text-white/30 font-mono mb-8">HN {current.hn_number}</p>
              )}

              {/* Please pick up badge */}
              <div className="inline-flex items-center gap-3 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-8 py-3">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                <span className="text-emerald-300 text-xl font-semibold">กรุณามารับยา</span>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="font-mono font-black text-[min(20vw,160px)] text-white/[0.07] leading-none mb-4">
                ---
              </p>
              <p className="text-white/20 text-lg">ยังไม่มีการเรียกคิว</p>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px bg-white/[0.06] my-12" />

        {/* ── Waiting list (right 1/3) ── */}
        <div className="w-72 flex flex-col px-6 py-12">
          <p className="text-white/30 text-xs uppercase tracking-[0.2em] mb-6">
            คิวรออยู่ ({waiting.length})
          </p>

          <div className="flex-1 space-y-2.5 overflow-hidden">
            {waiting.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-white/15 text-sm">ไม่มีคิวรอ</p>
              </div>
            ) : (
              waiting.map((q, i) => (
                <div
                  key={q.queue_id}
                  className={`flex items-center gap-4 rounded-xl px-4 py-3.5 border
                    ${i === 0
                      ? 'bg-sky-900/40 border-sky-600/30'
                      : 'bg-white/[0.04] border-white/[0.04]'
                    }`}
                >
                  <span className={`font-mono font-bold text-xl tabular-nums leading-none
                    ${i === 0 ? 'text-sky-300' : 'text-white/25'}`}>
                    {q.queue_number}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-sm truncate ${i === 0 ? 'text-white/80' : 'text-white/30'}`}>
                      {q.patient_name || 'ผู้ป่วย'}
                    </p>
                    {q.hn_number && (
                      <p className={`text-xs font-mono ${i === 0 ? 'text-white/30' : 'text-white/15'}`}>
                        HN {q.hn_number}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/[0.05] py-2.5 text-center">
        <p className="text-white/15 text-xs">PharmSub · อัปเดตทุก 5 วินาที</p>
      </div>
    </div>
  );
}
