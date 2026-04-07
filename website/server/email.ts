import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'TheFramedWall <noreply@theframedwall.com>';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn('[Email] SMTP not configured — skipping email');
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

async function sendMail(to: string, subject: string, html: string) {
  const t = getTransporter();
  if (!t) return;
  try {
    await t.sendMail({ from: SMTP_FROM, to, subject, html });
    console.log(`[Email] Sent "${subject}" to ${to}`);
  } catch (err) {
    console.error('[Email] Failed to send:', err);
  }
}

// ─── Email Templates ──────────────────────────────────

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function orderItemsTable(items: any[]) {
  const rows = items.map((item, i) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;">${i + 1}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;">${item.productName || item.productId}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;">${item.quantity || 1}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;">${item.color || '-'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;">${item.size || '-'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(item.price || 0)}</td>
    </tr>`).join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="background:#0E7C61;color:#fff;">
          <th style="padding:10px 12px;text-align:left;">#</th>
          <th style="padding:10px 12px;text-align:left;">Product</th>
          <th style="padding:10px 12px;text-align:center;">Qty</th>
          <th style="padding:10px 12px;text-align:left;">Color</th>
          <th style="padding:10px 12px;text-align:left;">Size</th>
          <th style="padding:10px 12px;text-align:right;">Price</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function baseLayout(title: string, body: string) {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
    <!-- Header -->
    <div style="background:#0E7C61;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:-.5px;">TheFramedWall</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Custom Print Studio</p>
    </div>
    <!-- Body -->
    <div style="background:#fff;padding:32px 24px;border-radius:0 0 12px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      ${body}
    </div>
    <!-- Footer -->
    <div style="text-align:center;padding:20px 0;color:#999;font-size:12px;">
      <p style="margin:0;">TheFramedWall &mdash; Premium Custom Prints</p>
      <p style="margin:4px 0 0;">This is an automated email, please do not reply.</p>
    </div>
  </div>
</body></html>`;
}

// ─── Customer Order Confirmation ──────────────────────

interface OrderEmailData {
  orderId: string;
  customerName: string;
  customerEmail: string;
  items: any[];
  total: number;
  shippingAddress: string;
  createdAt: string;
}

export async function sendOrderConfirmation(data: OrderEmailData) {
  const body = `
    <h2 style="color:#1a1a1a;margin:0 0 8px;">Order Confirmed! 🎉</h2>
    <p style="color:#666;margin:0 0 24px;">Hi <strong>${data.customerName}</strong>, thank you for your order. We're getting it ready!</p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;"><strong>Order ID:</strong> ${data.orderId}</p>
      <p style="margin:4px 0 0;font-size:14px;"><strong>Date:</strong> ${new Date(data.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      <p style="margin:4px 0 0;font-size:14px;"><strong>Status:</strong> <span style="color:#0E7C61;font-weight:600;">Confirmed</span></p>
    </div>

    <h3 style="color:#1a1a1a;margin:0 0 12px;font-size:16px;">Order Items</h3>
    ${orderItemsTable(data.items)}

    <div style="text-align:right;margin-top:16px;padding-top:16px;border-top:2px solid #0E7C61;">
      <p style="margin:0;font-size:20px;font-weight:700;color:#0E7C61;">Total: ${formatCurrency(data.total)}</p>
    </div>

    <h3 style="color:#1a1a1a;margin:24px 0 8px;font-size:16px;">Shipping Address</h3>
    <p style="color:#666;margin:0;font-size:14px;line-height:1.6;">${data.shippingAddress.replace(/\n/g, '<br>')}</p>

    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #eee;">
      <p style="color:#666;margin:0;font-size:13px;">Estimated delivery: <strong>3–5 business days</strong> across India.</p>
      <p style="color:#666;margin:4px 0 0;font-size:13px;">If you have questions, contact us at <a href="mailto:support@theframedwall.com" style="color:#0E7C61;">support@theframedwall.com</a></p>
    </div>`;

  await sendMail(data.customerEmail, `Order Confirmed — ${data.orderId}`, baseLayout('Order Confirmation', body));
}

// ─── Admin New Order Notification ──────────────────────

export async function sendAdminOrderNotification(data: OrderEmailData) {
  if (!ADMIN_EMAIL) return;

  const body = `
    <h2 style="color:#1a1a1a;margin:0 0 8px;">New Order Received</h2>
    <p style="color:#666;margin:0 0 24px;">A new order has been placed and needs your attention.</p>

    <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;"><strong>Order ID:</strong> ${data.orderId}</p>
      <p style="margin:4px 0 0;font-size:14px;"><strong>Customer:</strong> ${data.customerName} (${data.customerEmail})</p>
      <p style="margin:4px 0 0;font-size:14px;"><strong>Date:</strong> ${new Date(data.createdAt).toLocaleString('en-IN')}</p>
      <p style="margin:4px 0 0;font-size:14px;"><strong>Total:</strong> <span style="color:#0E7C61;font-weight:700;font-size:18px;">${formatCurrency(data.total)}</span></p>
    </div>

    <h3 style="color:#1a1a1a;margin:0 0 12px;font-size:16px;">Order Items</h3>
    ${orderItemsTable(data.items)}

    <h3 style="color:#1a1a1a;margin:24px 0 8px;font-size:16px;">Shipping Address</h3>
    <p style="color:#666;margin:0;font-size:14px;line-height:1.6;">${data.shippingAddress.replace(/\n/g, '<br>')}</p>

    <div style="text-align:center;margin-top:32px;">
      <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/admin" style="display:inline-block;background:#0E7C61;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">View in Admin Dashboard</a>
    </div>`;

  await sendMail(ADMIN_EMAIL, `🛒 New Order — ${data.orderId} — ${formatCurrency(data.total)}`, baseLayout('New Order Notification', body));
}

// ─── Design Order Emails ──────────────────────────────

interface DesignOrderEmailData {
  orderId: string;
  customerName: string;
  customerEmail: string;
  productType: string;
  colorName: string;
  printSize: string;
  sides: string[];
  quantity: number;
  unitPrice: number;
  total: number;
  shippingAddress: string;
  createdAt: string;
}

export async function sendDesignOrderConfirmation(data: DesignOrderEmailData) {
  const body = `
    <h2 style="color:#1a1a1a;margin:0 0 8px;">Design Order Confirmed! 🎨</h2>
    <p style="color:#666;margin:0 0 24px;">Hi <strong>${data.customerName}</strong>, your custom design order is being processed!</p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;"><strong>Order ID:</strong> ${data.orderId}</p>
      <p style="margin:4px 0 0;font-size:14px;"><strong>Date:</strong> ${new Date(data.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      <p style="margin:4px 0 0;font-size:14px;"><strong>Status:</strong> <span style="color:#0E7C61;font-weight:600;">Confirmed</span></p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin-bottom:24px;">
      <tr><td style="padding:8px 0;color:#666;"><strong>Product:</strong></td><td style="padding:8px 0;">${data.productType}</td></tr>
      <tr><td style="padding:8px 0;color:#666;"><strong>Color:</strong></td><td style="padding:8px 0;">${data.colorName}</td></tr>
      <tr><td style="padding:8px 0;color:#666;"><strong>Print Size:</strong></td><td style="padding:8px 0;">${data.printSize}</td></tr>
      <tr><td style="padding:8px 0;color:#666;"><strong>Sides:</strong></td><td style="padding:8px 0;">${data.sides.join(', ') || 'Front'}</td></tr>
      <tr><td style="padding:8px 0;color:#666;"><strong>Quantity:</strong></td><td style="padding:8px 0;">${data.quantity}</td></tr>
      <tr><td style="padding:8px 0;color:#666;"><strong>Unit Price:</strong></td><td style="padding:8px 0;">${formatCurrency(data.unitPrice)}</td></tr>
    </table>

    <div style="text-align:right;padding-top:16px;border-top:2px solid #0E7C61;">
      <p style="margin:0;font-size:20px;font-weight:700;color:#0E7C61;">Total: ${formatCurrency(data.total)}</p>
    </div>

    <h3 style="color:#1a1a1a;margin:24px 0 8px;font-size:16px;">Shipping Address</h3>
    <p style="color:#666;margin:0;font-size:14px;line-height:1.6;">${data.shippingAddress.replace(/\n/g, '<br>')}</p>

    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #eee;">
      <p style="color:#666;margin:0;font-size:13px;">Estimated delivery: <strong>5–7 business days</strong> for custom prints.</p>
      <p style="color:#666;margin:4px 0 0;font-size:13px;">If you have questions, contact us at <a href="mailto:support@theframedwall.com" style="color:#0E7C61;">support@theframedwall.com</a></p>
    </div>`;

  await sendMail(data.customerEmail, `Design Order Confirmed — ${data.orderId}`, baseLayout('Design Order Confirmation', body));
}

export async function sendAdminDesignOrderNotification(data: DesignOrderEmailData) {
  if (!ADMIN_EMAIL) return;

  const body = `
    <h2 style="color:#1a1a1a;margin:0 0 8px;">New Design Order Received</h2>
    <p style="color:#666;margin:0 0 24px;">A custom design order needs your attention.</p>

    <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;"><strong>Order ID:</strong> ${data.orderId}</p>
      <p style="margin:4px 0 0;font-size:14px;"><strong>Customer:</strong> ${data.customerName} (${data.customerEmail})</p>
      <p style="margin:4px 0 0;font-size:14px;"><strong>Total:</strong> <span style="color:#0E7C61;font-weight:700;font-size:18px;">${formatCurrency(data.total)}</span></p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin-bottom:24px;">
      <tr><td style="padding:8px 0;color:#666;"><strong>Product:</strong></td><td style="padding:8px 0;">${data.productType}</td></tr>
      <tr><td style="padding:8px 0;color:#666;"><strong>Color:</strong></td><td style="padding:8px 0;">${data.colorName}</td></tr>
      <tr><td style="padding:8px 0;color:#666;"><strong>Print Size:</strong></td><td style="padding:8px 0;">${data.printSize}</td></tr>
      <tr><td style="padding:8px 0;color:#666;"><strong>Sides:</strong></td><td style="padding:8px 0;">${data.sides.join(', ') || 'Front'}</td></tr>
      <tr><td style="padding:8px 0;color:#666;"><strong>Quantity:</strong></td><td style="padding:8px 0;">${data.quantity}</td></tr>
    </table>

    <div style="text-align:center;margin-top:24px;">
      <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/admin" style="display:inline-block;background:#0E7C61;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">View in Admin Dashboard</a>
    </div>`;

  await sendMail(ADMIN_EMAIL, `🎨 New Design Order — ${data.orderId} — ${formatCurrency(data.total)}`, baseLayout('New Design Order', body));
}

export async function sendNewsletterWelcome(email: string) {
  const body = `
    <h2 style="color:#1a1a1a;margin:0 0 8px;">You're subscribed! 🎉</h2>
    <p style="color:#666;margin:0 0 24px;">Thank you for subscribing to TheFramedWall updates. You'll be the first to hear about new products, exclusive deals, and design inspiration.</p>

    <div style="background:#f0faf7;border-radius:8px;padding:24px;margin-bottom:24px;text-align:center;">
      <p style="font-size:18px;font-weight:700;color:#0E7C61;margin:0 0 8px;">Get 10% off your first order!</p>
      <p style="color:#666;margin:0 0 16px;font-size:14px;">Use code <strong>WELCOME10</strong> at checkout.</p>
      <a href="${process.env.CLIENT_URL || 'https://theframedwall.com'}/design-studio" style="display:inline-block;background:#0E7C61;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Start Designing</a>
    </div>`;

  await sendMail(email, '🎨 Welcome to TheFramedWall — You\'re subscribed!', baseLayout('Welcome!', body));
}

export async function sendAdminNewsletterNotification(email: string) {
  if (!ADMIN_EMAIL) return;
  const body = `
    <h2 style="color:#1a1a1a;margin:0 0 8px;">New Newsletter Subscriber</h2>
    <p style="color:#444;font-size:15px;margin:0;"><strong>${email}</strong> has subscribed to the newsletter.</p>`;
  await sendMail(ADMIN_EMAIL, `📧 New Subscriber: ${email}`, baseLayout('New Subscriber', body));
}
