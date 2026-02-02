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
