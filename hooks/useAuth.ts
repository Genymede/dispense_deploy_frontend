"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/hooks/client";
import { User } from "@supabase/supabase-js";

interface SystemOption {
  id: number;
  name: string;
  code: string; 
}

export const useAuth = () => {
  const [departments, setDepartments] = useState<SystemOption[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const fetchAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          setUser(user);

          // --- ส่วนการแกะ DATA ---
          // 1. แกะ Systems (อิงตาม JSON ที่เรา Decode ได้)
          const systemsRaw = user.app_metadata?.systems || [];
          
          const systemOptions = systemsRaw.map((s: any) => ({
            id: s.id,      // ดึง ID มาแล้ว!
            name: s.name,  // ชื่อระบบ เช่น 'Administration'
            code: s.name,  // ใช้ชื่อเป็น code ไปด้วยเลย
          }));
          
          setDepartments(systemOptions);

          // 2. ถ้าคุณอยากได้แผนก (Departments) แยกต่างหาก ก็ทำได้เหมือนกัน:
          // const deptsRaw = user.app_metadata?.departments || [];
          // console.log("Departments list:", deptsRaw);
        }
      } catch (error) {
        console.error("Error fetching auth:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAuth();
  }, []);

  // คืนค่าออกไปใช้งาน
  return { 
    user, 
    departments, 
    isLoading,
    roleName: user?.app_metadata?.role?.name || "guest",
    roleId: user?.app_metadata?.role?.id || null,
    allMetadata: user?.app_metadata
  };
};