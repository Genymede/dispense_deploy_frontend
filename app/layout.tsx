import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/lib/auth';
import { AlertProvider } from '@/lib/alertContext';

export const metadata: Metadata = {
  title: 'PharmSub — ระบบบริหารคลังยาย่อย',
  description: 'ระบบบริหารจัดการคลังยาย่อยสำหรับแผนกจ่ายยา',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <AuthProvider>
          <AlertProvider>
            {children}
          </AlertProvider>
        </AuthProvider>
        <Toaster position="top-right"
          toastOptions={{
            style: { fontFamily: "'IBM Plex Sans Thai', sans-serif", fontSize: '14px', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' },
            success: { iconTheme: { primary: '#16a34a', secondary: 'white' } },
            error:   { iconTheme: { primary: '#dc2626', secondary: 'white' } },
          }} />
      </body>
    </html>
  );
}
