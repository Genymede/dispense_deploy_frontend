import { createBrowserClient } from '@supabase/ssr' // เพิ่มบรรทัดนี้

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      cookieOptions: {
        domain: ".hpk-hms.site", 
        path: "/",
        sameSite: "lax",
        secure: true,
      },
    }
  )