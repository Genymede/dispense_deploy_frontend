import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
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
          response.cookies.set({
            name,
            value,
            ...options,
            domain: ".hpk-hms.site",
          });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value: "",
            ...options,
            domain: ".hpk-hms.site",
          });
        },
      },
    }
  );

  // 1. ดึงข้อมูล User
  const { data: { user }, error } = await supabase.auth.getUser();

  // ถ้า Error หรือไม่มี User ให้เตะกลับไปหน้า Portal
  if (error || !user) {
    console.log("⚠️ [Middleware]: No user found, redirecting...");
    return NextResponse.redirect(new URL("https://hpk-hms.site", request.url));
  }

  // 2. แกะข้อมูลจาก Metadata (อิงตามก้อน JSON ที่ Decode ได้)
  // role เดิมเป็น {id: 1, name: "admin"} จึงต้องเข้าถึง .name
  const userRole = user.app_metadata?.role?.name || "";

  // systems เดิมเป็น [{id: 1, name: "OPD"}, ...] 
  // เราจะแปลงเป็น ["OPD", "Warehouse", ...] เพื่อให้ใช้ .includes() ได้ง่ายๆ
  const allowedSystems: string[] = (user.app_metadata?.systems || []).map(
    (s: any) => (typeof s === "string" ? s : s.name)
  );

  const path = request.nextUrl.pathname;

  console.log("------------------------------------------");
  console.log("✅ [User]:", user.email);
  console.log("👤 [Role]:", userRole);
  console.log("🛠️ [Systems]:", allowedSystems);
  console.log("📍 [Path]:", path);

  // 3. Logic การตรวจสอบสิทธิ์ (Access Control)

  // กรณีเป็น Super Admin ให้ผ่านได้ทุกหน้าทันที
  if (userRole === "admin") {
    return response;
  }

  // เช็คหน้า Warehouse
  if (path.startsWith("/warehouse")) {
    const isWarehouseStaff = ["warehouse_manager", "warehouse_staff"].includes(userRole);
    const hasWarehouseSystem = allowedSystems.includes("Warehouse");

    // ถ้าไม่มี Role ที่เกี่ยวข้อง "และ" ไม่มีระบบ Warehouse ในรายชื่อ ให้เด้งออก
    if (!isWarehouseStaff && !hasWarehouseSystem) {
      console.log("🚫 [Denied]: No Warehouse access");
      return NextResponse.redirect(new URL("https://hpk-hms.site/unauthorized", request.url));
    }
  }

  // เช็คหน้า Request (เบิกยืม)
  if (path.startsWith("/request")) {
    const hasBorrowSystem = allowedSystems.includes("Borrow-Return");
    if (!hasBorrowSystem) {
      console.log("🚫 [Denied]: No Borrow-Return access");
      return NextResponse.redirect(new URL("https://hpk-hms.site/unauthorized", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};