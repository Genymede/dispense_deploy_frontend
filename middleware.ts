import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // ใน development ให้ข้าม Supabase auth check — ใช้ login form เดิมแทน
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options, domain: '.hpk-hms.site' });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options, domain: '.hpk-hms.site' });
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  // ไม่มี session → เด้งกลับ portal หลัก
  if (error || !user) {
    // อนุญาตให้ /login แสดงได้ (จะ redirect ไป portal เอง)
    if (pathname === '/login') return NextResponse.next();
    return NextResponse.redirect(new URL('https://hpk-hms.site', request.url));
  }

  // มี session + อยู่ที่ / หรือ /login → ไป /dashboard ทันที
  if (pathname === '/' || pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // ส่ง user info ผ่าน header เพื่อให้ frontend อ่านได้ (server components)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-supabase-user-email', user.email ?? '');
  requestHeaders.set('x-supabase-user-role', user.app_metadata?.role?.name ?? '');

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
};
