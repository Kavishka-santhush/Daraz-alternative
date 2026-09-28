import { env } from '../../config/env';

/**
 * Server-rendered HTML email templates. Implemented as typed functions that
 * return full HTML documents. The project also ships @react-email/components;
 * these plain builders keep the API runnable without an extra JSX pipeline and
 * can be swapped one-for-one for React Email equivalents.
 */

function layout(title: string, bodyHtml: string, preview?: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title}</title></head>
  <body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
    <div style="display:none">${preview ?? title}</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 0">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
          <tr><td style="background:#f85606;padding:20px 28px;color:#fff;font-size:18px;font-weight:bold">${env.business.currency ? 'Marketplace' : 'Marketplace'}</td></tr>
          <tr><td style="padding:28px">
            ${bodyHtml}
            <p style="color:#888;font-size:12px;margin-top:28px">You are receiving this email because you have an account on Marketplace.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#f85606;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:bold">${label}</a>`;

export const templates = {
  verifyEmail(name: string, link: string) {
    return layout(
      'Verify your email',
      `<h2>Welcome, ${name} 👋</h2><p>Please confirm your email address to activate your account.</p>${button(link, 'Verify email')}<p style="color:#888;font-size:13px">Link expires in 24 hours.</p>`
    );
  },
  resetPassword(name: string, link: string) {
    return layout(
      'Reset your password',
      `<h2>Hi ${name},</h2><p>We received a request to reset your password. If this was you, continue below.</p>${button(link, 'Choose new password')}<p style="color:#888;font-size:13px">Ignore this email if you did not request a reset.</p>`
    );
  },
  otp(phone: string, code: string) {
    return layout('Your verification code', `<h2>Phone verification</h2><p>Enter this code to verify ${phone}:</p><p style="font-size:32px;letter-spacing:6px;font-weight:bold">${code}</p>`);
  },
  orderPlaced(name: string, orderNumber: string, total: number) {
    return layout(`Order ${orderNumber} confirmed`, `<h2>Thanks for your order, ${name}!</h2><p>Your order <strong>${orderNumber}</strong> for <strong>${env.business.currency} ${total.toLocaleString()}</strong> has been received.</p>${button(`${env.webUrl}/account/orders`, 'Track order')}`);
  },
  orderStatus(name: string, orderNumber: string, status: string) {
    return layout(`Order update`, `<h2>Order ${orderNumber}</h2><p>Hi ${name}, your order status is now <strong>${status}</strong>.</p>${button(`${env.webUrl}/account/orders/${orderNumber}`, 'View order')}`);
  },
  sellerNewOrder(shopName: string, orderNumber: string) {
    return layout('New order received', `<h2>New order for ${shopName}</h2><p>Order <strong>${orderNumber}</strong> needs your attention.</p>${button(`${env.webUrl}/seller/orders`, 'Manage orders')}`);
  },
  sellerApproved(name: string) {
    return layout('Seller account approved', `<h2>You're approved, ${name}! 🎉</h2><p>Your seller account has been verified. You can now list products and start selling.</p>${button(`${env.webUrl}/seller`, 'Open seller dashboard')}`);
  },
  sellerRejected(name: string, reason: string) {
    return layout('Seller application update', `<h2>Hi ${name},</h2><p>Unfortunately your seller application was not approved.</p><p><strong>Reason:</strong> ${reason}</p>`);
  },
  productRejected(name: string, title: string, reason: string) {
    return layout('Product needs changes', `<h2>Hi ${name},</h2><p>Your product <strong>${title}</strong> was rejected.</p><p><strong>Reason:</strong> ${reason}</p>`);
  },
  returnUpdate(name: string, returnNumber: string, status: string) {
    return layout('Return update', `<h2>Hi ${name},</h2><p>Your return <strong>${returnNumber}</strong> is now <strong>${status}</strong>.</p>`);
  },
  payoutProcessed(name: string, amount: number) {
    return layout('Payout processed', `<h2>Hi ${name},</h2><p>Your payout of <strong>${env.business.currency} ${amount.toLocaleString()}</strong> has been processed to your bank account.</p>`);
  },
  priceDrop(name: string, productTitle: string, link: string) {
    return layout('A wishlisted item dropped in price', `<h2>Hi ${name},</h2><p><strong>${productTitle}</strong> is now cheaper than when you saved it.</p>${button(link, 'View deal')}`);
  },
  lowStock(name: string, productTitle: string, remaining: number) {
    return layout('Low stock alert', `<h2>Hi ${name},</h2><p><strong>${productTitle}</strong> has only <strong>${remaining}</strong> units left.</p>${button(`${env.webUrl}/seller/inventory`, 'Restock now')}`);
  },
  generic(name: string, subject: string, message: string, link?: string) {
    return layout(subject, `<h2>Hi ${name},</h2><p>${message}</p>${link ? button(link, 'Open') : ''}`);
  },
};

export default templates;
