import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatPaisePlain } from './money';
import { formatISODate } from './dates';

export interface LedgerPdfRow {
  date: string;
  memo: string;
  debit: number; // paise
  credit: number; // paise
  balance: number; // paise, signed (+ = receivable)
}

/** Generate and download a party ledger statement PDF. */
export function exportPartyLedgerPDF(opts: {
  businessName: string;
  partyName: string;
  phone?: string | null;
  rows: LedgerPdfRow[];
  closing: number;
}) {
  const doc = new jsPDF();

  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(opts.businessName, 14, 16);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Party Ledger Statement', 14, 23);
  doc.setFontSize(10);
  doc.text(`Party: ${opts.partyName}${opts.phone ? `  ·  ${opts.phone}` : ''}`, 14, 30);
  doc.text(`Generated: ${formatISODate(new Date().toISOString().slice(0, 10))}`, 14, 35);

  autoTable(doc, {
    startY: 40,
    head: [['Date', 'Particulars', 'Debit (Rs)', 'Credit (Rs)', 'Balance (Rs)']],
    body: opts.rows.map((r) => [
      formatISODate(r.date),
      r.memo,
      r.debit ? formatPaisePlain(r.debit) : '',
      r.credit ? formatPaisePlain(r.credit) : '',
      `${formatPaisePlain(Math.abs(r.balance))} ${r.balance >= 0 ? 'Dr' : 'Cr'}`,
    ]),
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: [67, 83, 255] },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
  });

  const lastY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const label = opts.closing >= 0 ? 'Receivable from party' : 'Payable to party';
  doc.text(`Closing balance: Rs ${formatPaisePlain(Math.abs(opts.closing))}  (${label})`, 14, lastY + 8);

  doc.save(`ledger-${opts.partyName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`);
}
