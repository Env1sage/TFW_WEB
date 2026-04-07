import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'TheFramedWall <no-reply@theframedwall.com>';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@theframedwall.com';
const BASE_URL = (process.env.CLIENT_URL || 'https://theframedwall.com').replace(/\/$/, '');

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

// ─── Helpers ──────────────────────────────────────────

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** Convert a hex color code to a human-readable color name */
function hexToColorName(hex: string): string {
  if (!hex) return '-';
  const COLOR_NAMES: Record<string, string> = {
    '#ffffff': 'White', '#fff': 'White',
    '#000000': 'Black', '#000': 'Black',
    '#ff0000': 'Red', '#f00': 'Red',
    '#0000ff': 'Blue', '#00f': 'Blue',
    '#008000': 'Green',
    '#ffff00': 'Yellow', '#ff0': 'Yellow',
    '#ffa500': 'Orange',
    '#800080': 'Purple',
    '#ffc0cb': 'Pink',
    '#808080': 'Gray', '#888': 'Gray', '#888888': 'Gray',
    '#a52a2a': 'Brown',
    '#000080': 'Navy Blue',
    '#008080': 'Teal',
    '#40e0d0': 'Turquoise',
    '#ff69b4': 'Hot Pink',
    '#f5f5dc': 'Beige',
    '#fffdd0': 'Cream',
    '#fffff0': 'Ivory',
    '#c0c0c0': 'Silver',
    '#ffd700': 'Gold',
    '#800000': 'Maroon',
    '#006400': 'Dark Green',
    '#4169e1': 'Royal Blue',
    '#1e90ff': 'Dodger Blue',
    '#87ceeb': 'Sky Blue',
    '#add8e6': 'Light Blue',
    '#dc143c': 'Crimson',
    '#ff8c00': 'Dark Orange',
    '#ff4500': 'Orange Red',
    '#da70d6': 'Orchid',
    '#ee82ee': 'Violet',
    '#90ee90': 'Light Green',
    '#98fb98': 'Pale Green',
    '#ffb6c1': 'Light Pink',
    '#d3d3d3': 'Light Gray',
    '#2f4f4f': 'Dark Slate',
    '#191970': 'Midnight Blue',
    '#556b2f': 'Olive',
    '#20b2aa': 'Sea Green',
    '#b22222': 'Firebrick',
    '#f0e68c': 'Khaki',
    '#dda0dd': 'Plum',
    '#b0c4de': 'Steel Blue',
    '#cd853f': 'Peru',
    '#708090': 'Slate Gray',
    '#ff1493': 'Deep Pink',
    '#00ced1': 'Dark Turquoise',
    '#9370db': 'Medium Purple',
    '#3cb371': 'Medium Green',
    '#ff6347': 'Tomato',
    '#4682b4': 'Steel Blue',
    '#d2691e': 'Chocolate',
    '#bc8f8f': 'Rosy Brown',
  };
  const normalized = hex.toLowerCase().trim();
  return COLOR_NAMES[normalized] || hex;
}

/** Make product image URL absolute for email clients */
function absoluteImageUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** Render order items as mobile-friendly product cards */
function orderItemCards(items: any[]) {
  const cards = items.map(item => {
    const name = item.productName || item.productId || 'Product';
    const colorName = hexToColorName(item.color || '');
    const size = item.size || '';
    const qty = item.quantity || 1;
    const price = formatCurrency(item.price || 0);
    const imgUrl = item.productImage ? absoluteImageUrl(item.productImage) : '';

    const imgCell = imgUrl
      ? `<td width="72" style="padding:12px 0 12px 12px;vertical-align:middle;">
           <img src="${imgUrl}" width="56" height="56" alt="${name}"
             style="display:block;border-radius:8px;object-fit:cover;border:1px solid #eee;" />
         </td>`
      : `<td width="72" style="padding:12px 0 12px 12px;vertical-align:middle;">
           <div style="width:56px;height:56px;border-radius:8px;background:#f0fdf4;display:table-cell;text-align:center;vertical-align:middle;border:1px solid #eee;">
             <span style="font-size:22px;">👕</span>
           </div>
         </td>`;

    const meta = [colorName !== '-' ? colorName : '', size, `Qty: ${qty}`].filter(Boolean).join(' · ');

    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:8px;background:#f9fafb;border-radius:10px;border:1px solid #eee;">
      <tr>
        ${imgCell}
        <td style="padding:12px 8px 12px 10px;vertical-align:middle;">
          <div style="font-size:14px;font-weight:600;color:#1a1a1a;line-height:1.3;">${name}</div>
          <div style="font-size:12px;color:#888;margin-top:3px;">${meta}</div>
        </td>
        <td style="padding:12px 14px 12px 8px;vertical-align:middle;text-align:right;white-space:nowrap;">
          <div style="font-size:15px;font-weight:700;color:#0E7C61;">${price}</div>
        </td>
      </tr>
    </table>`;
  }).join('');

  return `<div style="margin-bottom:4px;">${cards}</div>`;
}

function baseLayout(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${title}</title>
  <style>
    @media only screen and (max-width:600px) {
      .email-wrapper { padding: 12px 8px !important; }
      .email-card { border-radius: 10px !important; }
      .email-body { padding: 20px 16px !important; }
      .email-header { padding: 20px 16px !important; }
      .email-header h1 { font-size: 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;">
    <tr><td align="center" class="email-wrapper" style="padding:28px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;" class="email-card">
        <!-- Header -->
        <tr>
          <td class="email-header" style="background:linear-gradient(135deg,#0E7C61 0%,#0a5e49 100%);padding:28px 32px;border-radius:14px 14px 0 0;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;letter-spacing:-.5px;">TheFramedWall</h1>
            <p style="margin:5px 0 0;color:rgba(255,255,255,0.75);font-size:13px;letter-spacing:.5px;">CUSTOM PRINT STUDIO</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td class="email-body" style="background:#fff;padding:32px 32px;border-radius:0 0 14px 14px;box-shadow:0 4px 16px rgba(0,0,0,0.07);">
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 16px;text-align:center;">
            <p style="margin:0;color:#aaa;font-size:12px;">TheFramedWall &mdash; Premium Custom Prints</p>
            <p style="margin:6px 0 0;color:#ccc;font-size:11px;">This is an automated email, please do not reply directly.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
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
    <h2 style="color:#1a1a1a;margin:0 0 6px;font-size:22px;">Order Confirmed! 🎉</h2>
    <p style="color:#555;margin:0 0 24px;font-size:15px;">Hi <strong>${data.customerName}</strong>, thank you for your order. We're getting it ready!</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;margin-bottom:24px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0;font-size:14px;"><strong>Order ID:</strong> <span style="color:#555;">${data.orderId}</span></p>
        <p style="margin:6px 0 0;font-size:14px;"><strong>Date:</strong> <span style="color:#555;">${new Date(data.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
        <p style="margin:6px 0 0;font-size:14px;"><strong>Status:</strong> <span style="color:#0E7C61;font-weight:700;">✓ Confirmed</span></p>
      </td></tr>
    </table>

    <h3 style="color:#1a1a1a;margin:0 0 12px;font-size:16px;">📦 Your Items</h3>
    ${orderItemCards(data.items)}

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-top:2px solid #0E7C61;">
      <tr>
        <td style="padding-top:14px;font-size:14px;color:#555;">Subtotal</td>
        <td style="padding-top:14px;font-size:14px;color:#555;text-align:right;">${formatCurrency(data.total)}</td>
      </tr>
      <tr>
        <td style="padding-top:4px;font-size:18px;font-weight:700;color:#0E7C61;">Total</td>
        <td style="padding-top:4px;font-size:18px;font-weight:700;color:#0E7C61;text-align:right;">${formatCurrency(data.total)}</td>
      </tr>
    </table>

    <h3 style="color:#1a1a1a;margin:24px 0 8px;font-size:16px;">📍 Shipping Address</h3>
    <p style="color:#666;margin:0;font-size:14px;line-height:1.7;background:#f9fafb;padding:12px 14px;border-radius:8px;border:1px solid #eee;">${data.shippingAddress.replace(/\n/g, '<br>')}</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid #eee;">
      <tr><td style="padding-top:20px;">
        <p style="color:#777;margin:0;font-size:13px;">🚚 Estimated delivery: <strong>3–5 business days</strong> across India.</p>
        <p style="color:#777;margin:8px 0 0;font-size:13px;">Questions? Write to us at <a href="mailto:support@theframedwall.com" style="color:#0E7C61;font-weight:600;">support@theframedwall.com</a></p>
      </td></tr>
    </table>`;

  await sendMail(data.customerEmail, `Order Confirmed ✓ — #${data.orderId.slice(-8).toUpperCase()}`, baseLayout('Order Confirmation', body));
}

// ─── Admin New Order Notification ──────────────────────

export async function sendAdminOrderNotification(data: OrderEmailData) {
  if (!ADMIN_EMAIL) return;

  const body = `
    <h2 style="color:#1a1a1a;margin:0 0 6px;font-size:22px;">New Order Received 🛒</h2>
    <p style="color:#555;margin:0 0 24px;font-size:15px;">A new order has been placed and is awaiting fulfilment.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;margin-bottom:24px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0;font-size:14px;"><strong>Order ID:</strong> ${data.orderId}</p>
        <p style="margin:6px 0 0;font-size:14px;"><strong>Customer:</strong> ${data.customerName} (${data.customerEmail})</p>
        <p style="margin:6px 0 0;font-size:14px;"><strong>Date:</strong> ${new Date(data.createdAt).toLocaleString('en-IN')}</p>
        <p style="margin:6px 0 0;font-size:16px;"><strong>Total:</strong> <span style="color:#0E7C61;font-weight:700;">${formatCurrency(data.total)}</span></p>
      </td></tr>
    </table>

    <h3 style="color:#1a1a1a;margin:0 0 12px;font-size:16px;">📦 Order Items</h3>
    ${orderItemCards(data.items)}

    <h3 style="color:#1a1a1a;margin:24px 0 8px;font-size:16px;">📍 Shipping Address</h3>
    <p style="color:#666;margin:0;font-size:14px;line-height:1.7;background:#f9fafb;padding:12px 14px;border-radius:8px;border:1px solid #eee;">${data.shippingAddress.replace(/\n/g, '<br>')}</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
      <tr><td align="center">
        <a href="${BASE_URL}/admin" style="display:inline-block;background:#0E7C61;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">View in Admin Dashboard →</a>
      </td></tr>
    </table>`;

  await sendMail(ADMIN_EMAIL, `🛒 New Order — #${data.orderId.slice(-8).toUpperCase()} — ${formatCurrency(data.total)}`, baseLayout('New Order Notification', body));
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
    <h2 style="color:#1a1a1a;margin:0 0 6px;font-size:22px;">Design Order Confirmed! 🎨</h2>
    <p style="color:#555;margin:0 0 24px;font-size:15px;">Hi <strong>${data.customerName}</strong>, your custom design order is being processed!</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;margin-bottom:24px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0;font-size:14px;"><strong>Order ID:</strong> <span style="color:#555;">${data.orderId}</span></p>
        <p style="margin:6px 0 0;font-size:14px;"><strong>Date:</strong> <span style="color:#555;">${new Date(data.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
        <p style="margin:6px 0 0;font-size:14px;"><strong>Status:</strong> <span style="color:#0E7C61;font-weight:700;">✓ Confirmed</span></p>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin-bottom:20px;background:#f9fafb;border-radius:10px;border:1px solid #eee;">
      <tr><td style="padding:10px 16px;border-bottom:1px solid #eee;color:#888;width:40%;">Product</td><td style="padding:10px 16px;border-bottom:1px solid #eee;font-weight:600;">${data.productType}</td></tr>
      <tr><td style="padding:10px 16px;border-bottom:1px solid #eee;color:#888;">Color</td><td style="padding:10px 16px;border-bottom:1px solid #eee;font-weight:600;">${data.colorName}</td></tr>
      <tr><td style="padding:10px 16px;border-bottom:1px solid #eee;color:#888;">Print Size</td><td style="padding:10px 16px;border-bottom:1px solid #eee;font-weight:600;">${data.printSize}</td></tr>
      <tr><td style="padding:10px 16px;border-bottom:1px solid #eee;color:#888;">Sides</td><td style="padding:10px 16px;border-bottom:1px solid #eee;font-weight:600;">${data.sides.join(', ') || 'Front'}</td></tr>
      <tr><td style="padding:10px 16px;border-bottom:1px solid #eee;color:#888;">Quantity</td><td style="padding:10px 16px;border-bottom:1px solid #eee;font-weight:600;">${data.quantity}</td></tr>
      <tr><td style="padding:10px 16px;color:#888;">Unit Price</td><td style="padding:10px 16px;font-weight:600;">${formatCurrency(data.unitPrice)}</td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #0E7C61;">
      <tr>
        <td style="padding-top:14px;font-size:18px;font-weight:700;color:#0E7C61;">Total</td>
        <td style="padding-top:14px;font-size:18px;font-weight:700;color:#0E7C61;text-align:right;">${formatCurrency(data.total)}</td>
      </tr>
    </table>

    <h3 style="color:#1a1a1a;margin:24px 0 8px;font-size:16px;">📍 Shipping Address</h3>
    <p style="color:#666;margin:0;font-size:14px;line-height:1.7;background:#f9fafb;padding:12px 14px;border-radius:8px;border:1px solid #eee;">${data.shippingAddress.replace(/\n/g, '<br>')}</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid #eee;">
      <tr><td style="padding-top:20px;">
        <p style="color:#777;margin:0;font-size:13px;">🚚 Estimated delivery: <strong>5–7 business days</strong> for custom prints.</p>
        <p style="color:#777;margin:8px 0 0;font-size:13px;">Questions? Write to us at <a href="mailto:support@theframedwall.com" style="color:#0E7C61;font-weight:600;">support@theframedwall.com</a></p>
      </td></tr>
    </table>`;

  await sendMail(data.customerEmail, `Design Order Confirmed ✓ — #${data.orderId.slice(-8).toUpperCase()}`, baseLayout('Design Order Confirmation', body));
}

export async function sendAdminDesignOrderNotification(data: DesignOrderEmailData) {
  if (!ADMIN_EMAIL) return;

  const body = `
    <h2 style="color:#1a1a1a;margin:0 0 6px;font-size:22px;">New Design Order 🎨</h2>
    <p style="color:#555;margin:0 0 24px;font-size:15px;">A custom design order needs your attention.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;margin-bottom:24px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0;font-size:14px;"><strong>Order ID:</strong> ${data.orderId}</p>
        <p style="margin:6px 0 0;font-size:14px;"><strong>Customer:</strong> ${data.customerName} (${data.customerEmail})</p>
        <p style="margin:6px 0 0;font-size:16px;"><strong>Total:</strong> <span style="color:#0E7C61;font-weight:700;">${formatCurrency(data.total)}</span></p>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin-bottom:20px;background:#f9fafb;border-radius:10px;border:1px solid #eee;">
      <tr><td style="padding:10px 16px;border-bottom:1px solid #eee;color:#888;width:40%;">Product</td><td style="padding:10px 16px;border-bottom:1px solid #eee;font-weight:600;">${data.productType}</td></tr>
      <tr><td style="padding:10px 16px;border-bottom:1px solid #eee;color:#888;">Color</td><td style="padding:10px 16px;border-bottom:1px solid #eee;font-weight:600;">${data.colorName}</td></tr>
      <tr><td style="padding:10px 16px;border-bottom:1px solid #eee;color:#888;">Print Size</td><td style="padding:10px 16px;border-bottom:1px solid #eee;font-weight:600;">${data.printSize}</td></tr>
      <tr><td style="padding:10px 16px;border-bottom:1px solid #eee;color:#888;">Sides</td><td style="padding:10px 16px;border-bottom:1px solid #eee;font-weight:600;">${data.sides.join(', ') || 'Front'}</td></tr>
      <tr><td style="padding:10px 16px;color:#888;">Quantity</td><td style="padding:10px 16px;font-weight:600;">${data.quantity}</td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
      <tr><td align="center">
        <a href="${BASE_URL}/admin" style="display:inline-block;background:#0E7C61;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">View in Admin Dashboard →</a>
      </td></tr>
    </table>`;

  await sendMail(ADMIN_EMAIL, `🎨 New Design Order — #${data.orderId.slice(-8).toUpperCase()} — ${formatCurrency(data.total)}`, baseLayout('New Design Order', body));
}

// ─── Delivery Status Update ───────────────────────────

const STATUS_CONFIG: Record<string, { emoji: string; title: string; subtitle: string; color: string; bgColor: string; borderColor: string }> = {
  confirmed:        { emoji: '✅', title: 'Order Confirmed!',           subtitle: "Your order has been confirmed and we're preparing it.",   color: '#0E7C61', bgColor: '#f0fdf4', borderColor: '#bbf7d0' },
  processing:       { emoji: '⚙️', title: 'Order Being Processed',      subtitle: 'Your order is being picked and packed by our team.',       color: '#0284c7', bgColor: '#f0f9ff', borderColor: '#bae6fd' },
  shipped:          { emoji: '🚚', title: 'Order Shipped!',             subtitle: 'Your order is on its way! Track it with the details below.', color: '#7c3aed', bgColor: '#faf5ff', borderColor: '#ddd6fe' },
  out_for_delivery: { emoji: '📦', title: 'Out for Delivery!',          subtitle: 'Your order is with the delivery agent and arriving today!',  color: '#d97706', bgColor: '#fffbeb', borderColor: '#fde68a' },
  delivered:        { emoji: '🎉', title: 'Order Delivered!',           subtitle: 'Your order has been delivered. Enjoy your purchase!',       color: '#0E7C61', bgColor: '#f0fdf4', borderColor: '#bbf7d0' },
  cancelled:        { emoji: '❌', title: 'Order Cancelled',            subtitle: 'Your order has been cancelled. If this was unexpected, please contact us.', color: '#dc2626', bgColor: '#fef2f2', borderColor: '#fecaca' },
};

interface OrderStatusEmailData {
  orderId: string;
  customerName: string;
  customerEmail: string;
  status: string;
  items?: any[];
  total?: number;
  awbCode?: string;
  courierName?: string;
}

export async function sendOrderStatusUpdate(data: OrderStatusEmailData) {
  const cfg = STATUS_CONFIG[data.status];
  if (!cfg) return; // don't send email for unknown statuses

  const trackingSection = (data.status === 'shipped' || data.status === 'out_for_delivery') && (data.awbCode || data.courierName) ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f4ff;border:1px solid #ddd6fe;border-radius:10px;margin-top:20px;margin-bottom:4px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0;font-size:13px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:.5px;">Tracking Info</p>
        ${data.courierName ? `<p style="margin:8px 0 0;font-size:14px;"><strong>Courier:</strong> ${data.courierName}</p>` : ''}
        ${data.awbCode ? `<p style="margin:6px 0 0;font-size:14px;"><strong>AWB / Tracking No.:</strong> <span style="font-family:monospace;font-weight:700;">${data.awbCode}</span></p>` : ''}
      </td></tr>
    </table>` : '';

  const itemsSection = data.items?.length ? `
    <h3 style="color:#1a1a1a;margin:20px 0 10px;font-size:15px;">📦 Your Items</h3>
    ${orderItemCards(data.items)}` : '';

  const body = `
    <h2 style="color:#1a1a1a;margin:0 0 6px;font-size:22px;">${cfg.emoji} ${cfg.title}</h2>
    <p style="color:#555;margin:0 0 24px;font-size:15px;">Hi <strong>${data.customerName}</strong>, ${cfg.subtitle}</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:${cfg.bgColor};border:1px solid ${cfg.borderColor};border-radius:10px;margin-bottom:20px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0;font-size:14px;"><strong>Order ID:</strong> <span style="color:#555;">${data.orderId}</span></p>
        <p style="margin:6px 0 0;font-size:15px;"><strong>Status:</strong> <span style="color:${cfg.color};font-weight:700;">${cfg.emoji} ${cfg.title.replace('!', '')}</span></p>
        ${data.total ? `<p style="margin:6px 0 0;font-size:14px;"><strong>Order Total:</strong> ${formatCurrency(data.total)}</p>` : ''}
      </td></tr>
    </table>

    ${trackingSection}
    ${itemsSection}

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-top:1px solid #eee;">
      <tr><td style="padding-top:20px;">
        <p style="color:#777;margin:0;font-size:13px;">Need help? Write to <a href="mailto:support@theframedwall.com" style="color:#0E7C61;font-weight:600;">support@theframedwall.com</a></p>
      </td></tr>
    </table>`;

  const subjects: Record<string, string> = {
    confirmed:        `Order Confirmed ✓ — #${data.orderId.slice(-8).toUpperCase()}`,
    processing:       `Your Order is Being Prepared — #${data.orderId.slice(-8).toUpperCase()}`,
    shipped:          `📦 Your Order is Shipped — #${data.orderId.slice(-8).toUpperCase()}`,
    out_for_delivery: `🚚 Out for Delivery Today — #${data.orderId.slice(-8).toUpperCase()}`,
    delivered:        `🎉 Delivered! — #${data.orderId.slice(-8).toUpperCase()}`,
    cancelled:        `Order Cancelled — #${data.orderId.slice(-8).toUpperCase()}`,
  };

  await sendMail(data.customerEmail, subjects[data.status] || `Order Update — #${data.orderId.slice(-8).toUpperCase()}`, baseLayout('Order Update', body));
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
