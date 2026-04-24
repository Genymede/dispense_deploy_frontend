"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default async function exportPDF({
  filename = "report.pdf",
  columns = [],
  rows = [],
  title = "",
  // ลบ/ไม่รับ orientation เพื่อบังคับแนวตั้งเท่านั้น
} = {}) {
  // ล็อกแนวตั้งเท่านั้น + กำหนดหน่วย/กระดาษชัดเจน
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  // โหลดฟอนต์/โลโก้จาก public
  const [regularBuffer, boldBuffer, logoBuffer] = await Promise.all([
    fetch("/font/ThaiSarabun/subset-Sarabun-Regular.ttf").then((res) =>
      res.arrayBuffer()
    ),
    fetch("/font/ThaiSarabun/subset-Sarabun-Bold.ttf").then((res) =>
      res.arrayBuffer()
    ),
    fetch("/logo.png").then((res) => res.arrayBuffer()).catch(() => null),
  ]);

  const toBase64 = (buffer) =>
    btoa(String.fromCharCode(...new Uint8Array(buffer)));

  // เพิ่มฟอนต์ Sarabun
  doc.addFileToVFS("Sarabun.ttf", toBase64(regularBuffer));
  doc.addFont("Sarabun.ttf", "Sarabun", "normal");

  doc.addFileToVFS("Sarabun-Bold.ttf", toBase64(boldBuffer));
  doc.addFont("Sarabun-Bold.ttf", "Sarabun", "bold");

  // ข้อมูลโรงพยาบาล
  const hospitalInfo = {
    name: "โรงพยาบาลวัดห้วยปลากั้งเพื่อสังคม",
    address: "553 11 ตำบล บ้านดู่ อำเภอเมืองเชียงราย เชียงราย 57100",
    phone: "052 029 888",
  };

  // วันที่ปัจจุบัน
  const currentDate = new Date().toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // ฟังก์ชันวาดส่วนหัว/ท้ายทุกหน้า (รองรับเฉพาะ portrait)
  const addHeaderAndFooter = (data) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageCount = doc.internal.getNumberOfPages();
    const isLastPage = data.pageNumber === pageCount;

    // ส่วนหัว
    doc.setFont("Sarabun", "bold");
    doc.setFontSize(14);
    doc.text(hospitalInfo.name, pageWidth / 2, 15, { align: "center" });

    doc.setFont("Sarabun", "normal");
    doc.setFontSize(10);
    doc.text(hospitalInfo.address, pageWidth / 2, 22, { align: "center" });
    doc.text(`โทร: ${hospitalInfo.phone}`, pageWidth / 2, 28, {
      align: "center",
    });
    doc.text(`วันที่: ${currentDate}`, pageWidth / 2, 34, { align: "center" });

    doc.setFont("Sarabun", "bold");
    doc.setFontSize(12);
    doc.text(title || "รายงาน", pageWidth / 2, 42, { align: "center" });

    // โลโก้ (ถ้ามี)
    if (logoBuffer) {
      const logoBase64 = toBase64(logoBuffer);
      // วางซ้ายบนให้พอดีในแนวตั้ง
      doc.addImage(logoBase64, "PNG", 10, 10, 24, 24);
    }

    // หมายเลขหน้า
    doc.setFont("Sarabun", "normal");
    doc.setFontSize(10);
    doc.text(
      `หน้า ${data.pageNumber} จาก ${pageCount}`,
      pageWidth - 15,
      pageHeight - 10,
      { align: "right" }
    );

    // ส่วนท้าย (เฉพาะหน้าสุดท้าย)
    if (isLastPage) {
      const startY =
        data.cursor.y > pageHeight / 2 ? data.cursor.y + 10 : pageHeight / 2;

      doc.setFont("Sarabun", "bold");
      doc.setFontSize(10);
      doc.text("ลงชื่อ", pageWidth *0.7, startY, { align: "left" });

      doc.setFont("Sarabun", "normal");
      doc.setFontSize(8);
      doc.text(
        "........................................................................................     ผู้จัดทำ",
        pageWidth * 0.55,
        startY + 10,
        { align: "left" }
      );
      doc.text(
        "( ....................................................................................)       ตำแหน่ง",
        pageWidth * 0.55,
        startY + 20,
        { align: "left" }
      );
      doc.text(
        "วันที่: ...................................................................................",
        pageWidth * 0.55,
        startY + 30,
        { align: "left" }
      );
    }
  };

  // ตารางข้อมูลหลัก
  await autoTable(doc, {
    startY: 50,
    theme: "grid",
    head: [columns],
    body: rows,
    styles: {
      font: "Sarabun",
      fontSize: 8,
      cellPadding: 2,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      font: "Sarabun",
      fontStyle: "bold",
      fillColor: [175, 175, 175],
      textColor: 0,
    },
    margin: { top: 50, bottom: 60, left: 10, right: 10 },
    didDrawPage: addHeaderAndFooter,
  });

  // บันทึกไฟล์ PDF
  doc.save(filename);
}
