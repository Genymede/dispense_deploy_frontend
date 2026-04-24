'use client';
/**
 * RegistryPage — Shared component สำหรับทุกหน้าทะเบียนและรายงาน
 *
 * ใช้งาน:
 *   <RegistryPage title="..." cols={...} fetcher={...} detail={row => <.../>} />
 *
 * กด row ใดก็ได้ → modal แสดงรายละเอียด
 * ไม่มี global state ที่ซ้อนกัน ไม่มี scope leak
 */

import { ReactNode, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';