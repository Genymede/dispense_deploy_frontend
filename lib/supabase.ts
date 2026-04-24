// re-export จาก hooks/client.ts ซึ่งมีการตั้งค่า cookie options สำหรับ .hpk-hms.site ครบถ้วน
export { createClient as createSupabaseClient } from '@/hooks/client';
