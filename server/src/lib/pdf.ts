import fs from 'fs';
import path from 'path';
import { env } from '../config/env';
import logger from '../config/logger';
import { UPLOAD_ROOT, toPublicUrl } from './upload';

/**
 * Renders an HTML document to PDF using Puppeteer and stores it under
 * /uploads/documents/. Falls back to writing the raw HTML if Chromium is
 * unavailable (e.g. CI without the browser binary) so callers never crash.
 */
export async function htmlToPdfFile(html: string, fileName: string): Promise<string> {
  const dir = path.join(UPLOAD_ROOT, 'documents');
  fs.mkdirSync(dir, { recursive: true });
  const safeName = `${Date.now()}-${fileName.replace(/[^a-z0-9._-]/gi, '')}`;
  const absPath = path.join(dir, safeName);

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({ path: absPath, format: 'A4', printBackground: true });
    await browser.close();
  } catch (err) {
    logger.warn('Puppeteer unavailable, storing HTML fallback for PDF', (err as Error).message);
    fs.writeFileSync(absPath.replace(/\.pdf$/i, '.html'), html, 'utf-8');
    return toPublicUrl(absPath.replace(/\.pdf$/i, '.html'));
  }
  return toPublicUrl(absPath);
}

const currency = (n: number) => `${env.business.currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export interface InvoiceLine {
  title: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceData {
  number: string;
  buyerName: string;
  buyerEmail: string;
  address: Record<string, string>;
  shopName: string;
  lines: InvoiceLine[];
  subtotal: number;
  shipping: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  placedAt: string;
}

export function renderInvoiceHtml(inv: InvoiceData): string {
  const rows = inv.lines
    .map(
      (l) => `<tr>
        <td>${l.title}</td><td style="text-align:center">${l.qty}</td>
        <td style="text-align:right">${currency(l.unitPrice)}</td>
        <td style="text-align:right">${currency(l.total)}</td></tr>`
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${inv.number}</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:40px}
    h1{font-size:22px;margin:0 0 4px}
    .muted{color:#666;font-size:12px}
    table{width:100%;border-collapse:collapse;margin-top:24px}
    th,td{padding:8px;border-bottom:1px solid #eee;font-size:13px}
    th{background:#f6f6f6;text-align:left}
    .totals{margin-top:16px;width:280px;margin-left:auto}
    .totals td{border:none;padding:4px 8px}
    .grand{font-weight:bold;font-size:15px}
    .badge{display:inline-block;background:#f85606;color:#fff;padding:4px 10px;border-radius:4px;font-size:12px}
  </style></head><body>
    <div style="display:flex;justify-content:space-between">
      <div><h1>${inv.shopName}</h1><div class="muted">Seller invoice</div></div>
      <div style="text-align:right"><span class="badge">INVOICE</span><div class="muted">#${inv.number}</div><div class="muted">${inv.placedAt}</div></div>
    </div>
    <div style="margin-top:24px"><strong>Bill to</strong><div class="muted">${inv.buyerName} · ${inv.buyerEmail}</div>
      <div class="muted">${[inv.address.line1, inv.address.line2, inv.address.city, inv.address.province, inv.address.postalCode].filter(Boolean).join(', ')}</div></div>
    <table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <table class="totals"><tbody>
      <tr><td>Subtotal</td><td style="text-align:right">${currency(inv.subtotal)}</td></tr>
      <tr><td>Shipping</td><td style="text-align:right">${currency(inv.shipping)}</td></tr>
      <tr><td>Discount</td><td style="text-align:right">-${currency(inv.discount)}</td></tr>
      <tr><td>Tax</td><td style="text-align:right">${currency(inv.tax)}</td></tr>
      <tr class="grand"><td>Total (${inv.paymentMethod})</td><td style="text-align:right">${currency(inv.total)}</td></tr>
    </tbody></table>
    <p class="muted" style="margin-top:32px">Thank you for shopping on the marketplace.</p>
  </body></html>`;
}
