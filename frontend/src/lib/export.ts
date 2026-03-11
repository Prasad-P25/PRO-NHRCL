import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format as formatDate } from 'date-fns';

export type ExportFormat = 'pdf' | 'excel';

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ExportOptions {
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  data: any[];
  filename: string;
}

// Export to Excel
export const exportToExcel = (options: ExportOptions): void => {
  const { title, columns, data, filename } = options;

  // Create worksheet data
  const wsData = [
    [title],
    [`Generated on: ${formatDate(new Date(), 'PPpp')}`],
    [],
    columns.map((col) => col.header),
    ...data.map((row) => columns.map((col) => row[col.key] ?? '')),
  ];

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = columns.map((col) => ({ wch: col.width || 15 }));

  // Merge title cell
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Report');

  // Download
  XLSX.writeFile(wb, `${filename}_${formatDate(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
};

// Export to PDF
export const exportToPDF = (options: ExportOptions): void => {
  const { title, subtitle, columns, data, filename } = options;

  // Create PDF document
  const doc = new jsPDF({
    orientation: columns.length > 6 ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Add title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 15);

  // Add subtitle/date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle || `Generated on: ${formatDate(new Date(), 'PPpp')}`, 14, 22);

  // Add table
  autoTable(doc, {
    head: [columns.map((col) => col.header)],
    body: data.map((row) => columns.map((col) => String(row[col.key] ?? ''))),
    startY: 28,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    margin: { top: 28, left: 14, right: 14 },
  });

  // Download
  doc.save(`${filename}_${formatDate(new Date(), 'yyyyMMdd_HHmmss')}.pdf`);
};

// Generic export function
export const exportReport = (format: ExportFormat, options: ExportOptions): void => {
  if (format === 'excel') {
    exportToExcel(options);
  } else {
    exportToPDF(options);
  }
};

// Comprehensive Audit Report PDF
export interface AuditReportOptions {
  auditNumber: string;
  packageCode: string;
  packageName: string;
  auditType: string;
  scheduledDate: string;
  status: string;
  auditorName: string;
  contractorRep?: string;
  compliancePercentage?: number;
  categories: {
    name: string;
    sections: {
      name: string;
      items: {
        srNo: number;
        auditPoint: string;
        status: string;
        observation?: string;
        riskRating?: string;
        capaRequired?: boolean;
      }[];
    }[];
  }[];
  summary: {
    totalItems: number;
    compliant: number;
    nonCompliant: number;
    notApplicable: number;
    notVerified: number;
  };
}

export const exportAuditReportPDF = (options: AuditReportOptions): void => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 15;

  // Header
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('SAFETY AUDIT REPORT', 14, 15);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(options.auditNumber, 14, 23);
  doc.text(`Package: ${options.packageCode} - ${options.packageName}`, 14, 30);

  // Reset text color
  doc.setTextColor(0, 0, 0);
  yPos = 45;

  // Audit Info Box
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(14, yPos, pageWidth - 28, 35, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Audit Type:', 20, yPos + 8);
  doc.text('Status:', 20, yPos + 16);
  doc.text('Scheduled Date:', 20, yPos + 24);
  doc.text('Auditor:', 100, yPos + 8);
  doc.text('Contractor Rep:', 100, yPos + 16);
  doc.text('Compliance:', 100, yPos + 24);

  doc.setFont('helvetica', 'normal');
  doc.text(options.auditType, 50, yPos + 8);
  doc.text(options.status, 50, yPos + 16);
  doc.text(options.scheduledDate || '-', 50, yPos + 24);
  doc.text(options.auditorName || '-', 135, yPos + 8);
  doc.text(options.contractorRep || '-', 135, yPos + 16);

  // Compliance with color
  const compliance = options.compliancePercentage || 0;
  if (compliance >= 80) {
    doc.setTextColor(34, 197, 94);
  } else if (compliance >= 60) {
    doc.setTextColor(245, 158, 11);
  } else {
    doc.setTextColor(239, 68, 68);
  }
  doc.setFont('helvetica', 'bold');
  doc.text(`${compliance}%`, 135, yPos + 24);
  doc.setTextColor(0, 0, 0);

  yPos += 45;

  // Summary Box
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', 14, yPos);
  yPos += 5;

  const summaryData = [
    ['Total Items', options.summary.totalItems.toString()],
    ['Compliant (C)', options.summary.compliant.toString()],
    ['Non-Compliant (NC)', options.summary.nonCompliant.toString()],
    ['Not Applicable (NA)', options.summary.notApplicable.toString()],
    ['Not Verified (NV)', options.summary.notVerified.toString()],
  ];

  autoTable(doc, {
    body: summaryData,
    startY: yPos,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { halign: 'center', cellWidth: 30 },
    },
    margin: { left: 14 },
    tableWidth: 80,
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Audit Items by Category
  for (const category of options.categories) {
    // Check if we need a new page
    if (yPos > pageHeight - 50) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(243, 244, 246);
    doc.rect(14, yPos - 4, pageWidth - 28, 8, 'F');
    doc.text(category.name, 16, yPos + 1);
    yPos += 10;

    for (const section of category.sections) {
      if (section.items.length === 0) continue;

      // Section header
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(section.name, 14, yPos);
      yPos += 3;

      // Items table
      const tableData = section.items.map((item) => [
        item.srNo.toString(),
        item.auditPoint.length > 60 ? item.auditPoint.substring(0, 57) + '...' : item.auditPoint,
        item.status || '-',
        item.riskRating || '-',
        item.observation ? (item.observation.length > 30 ? item.observation.substring(0, 27) + '...' : item.observation) : '-',
      ]);

      autoTable(doc, {
        head: [['#', 'Audit Point', 'Status', 'Risk', 'Observation']],
        body: tableData,
        startY: yPos,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: {
          fillColor: [100, 116, 139],
          textColor: 255,
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 70 },
          2: { cellWidth: 15, halign: 'center' },
          3: { cellWidth: 20, halign: 'center' },
          4: { cellWidth: 50 },
        },
        margin: { left: 14, right: 14 },
        didParseCell: (data) => {
          if (data.column.index === 2 && data.section === 'body') {
            const status = data.cell.raw as string;
            if (status === 'C') {
              data.cell.styles.textColor = [34, 197, 94];
              data.cell.styles.fontStyle = 'bold';
            } else if (status === 'NC') {
              data.cell.styles.textColor = [239, 68, 68];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
      });

      yPos = (doc as any).lastAutoTable.finalY + 8;

      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = 20;
      }
    }
  }

  // Signature Section
  if (yPos > pageHeight - 60) {
    doc.addPage();
    yPos = 20;
  }

  yPos += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Signatures', 14, yPos);
  yPos += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  // Auditor signature
  doc.text('Auditor:', 14, yPos);
  doc.line(35, yPos, 90, yPos);
  doc.text('Date:', 95, yPos);
  doc.line(108, yPos, 140, yPos);

  yPos += 15;

  // Contractor signature
  doc.text('Contractor Rep:', 14, yPos);
  doc.line(45, yPos, 90, yPos);
  doc.text('Date:', 95, yPos);
  doc.line(108, yPos, 140, yPos);

  yPos += 15;

  // Reviewer signature
  doc.text('Reviewed By:', 14, yPos);
  doc.line(40, yPos, 90, yPos);
  doc.text('Date:', 95, yPos);
  doc.line(108, yPos, 140, yPos);

  // Footer on each page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Generated on ${formatDate(new Date(), 'PPpp')} | Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    doc.text('PROTECTHER Audit Panel', 14, pageHeight - 10);
  }

  // Download
  doc.save(`${options.auditNumber}_Report_${formatDate(new Date(), 'yyyyMMdd')}.pdf`);
};
