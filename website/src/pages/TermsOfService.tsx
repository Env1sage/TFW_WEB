import { motion } from 'framer-motion';
import { FileText } from 'lucide-react';

const SECTIONS = [
  {
    title: '1. Products & Services',
    content: `TheFramedWall offers:
• Customized apparel including T-shirts, hoodies, caps, and corporate wear
• Customized accessories including stickers, mouse pads, acrylic products, pin badges, and more
• Bulk corporate merchandise solutions
• Print-on-demand and personalized products

All products displayed on the website are subject to availability.`,
  },
  {
    title: '2. Custom Design Responsibility',
    content: `Customers submitting logos, artwork, text, or graphics confirm that:
• They own the rights to use the submitted content, or
• They have obtained permission from the rightful owner

TheFramedWall is not responsible for copyright or trademark violations caused by customer-submitted designs.

We reserve the right to reject any design containing:
• Offensive or hateful content
• Illegal material
• Copyrighted/trademarked content without authorization
• Explicit or inappropriate imagery`,
  },
  {
    title: '3. Order Acceptance & Cancellation',
    content: `Once an order is placed:
• It may not be cancelled after production has started
• Customized products cannot be modified after approval
• Bulk orders may require advance payment confirmation before production

We reserve the right to refuse or cancel any order due to:
• Pricing errors
• Fraud suspicion
• Product availability
• Violation of these terms`,
  },
  {
    title: '4. Pricing & Payments',
    content: `All prices are listed in INR unless otherwise stated.

We reserve the right to:
• Change product pricing without prior notice
• Modify or discontinue products anytime

Payments are securely processed through third-party payment gateways.`,
  },
  {
    title: '5. Production & Color Variations',
    content: `As many products are customized:
• Actual print colors may slightly vary from digital previews
• Placement and sizing may differ slightly depending on garment size and material
• Minor variations are considered normal production tolerances`,
  },
  {
    title: '6. Shipping & Delivery',
    content: `Delivery timelines are estimates and may vary depending on:
• Location
• Courier operations
• Production workload
• Public holidays or unforeseen delays

TheFramedWall is not liable for delays caused by courier partners or circumstances beyond our control.`,
  },
  {
    title: '7. Intellectual Property',
    content: `All website content including logos, product images, graphics, branding, and text content belongs to TheFramedWall and may not be copied, reproduced, or used without written permission.`,
  },
  {
    title: '8. Limitation of Liability',
    content: `TheFramedWall shall not be liable for:
• Indirect or incidental damages
• Loss of profits
• Delays caused by third parties
• Customer-uploaded content misuse

Our total liability shall not exceed the value of the order placed.`,
  },
  {
    title: '9. Privacy',
    content: `Your use of our website is also governed by our Privacy Policy.`,
  },
  {
    title: '10. Governing Law',
    content: `These Terms shall be governed by the laws of India. Any disputes shall fall under the jurisdiction of courts located in Maharashtra, India.`,
  },
  {
    title: '11. Contact Information',
    content: `For any questions regarding these Terms, contact:\n\nTheFramedWall\nEmail: support@theframedwall.com\nWebsite: theframedwall.com`,
  },
];

export default function TermsOfService() {
  return (
    <div className="legal-page">
      <div className="container" style={{ maxWidth: 800 }}>
        <motion.div className="legal-header" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="legal-icon"><FileText size={28} /></div>
          <h1>Terms of Service</h1>
          <p className="legal-updated">Last Updated: May 15, 2026</p>
          <p className="legal-intro">
            Welcome to TheFramedWall. By accessing our website, placing an order, or using any of our services,
            you agree to the following Terms of Service. If you do not agree with these terms, please do not use our website or services.
          </p>
        </motion.div>

        <div className="legal-body">
          {SECTIONS.map((s, i) => (
            <motion.div key={s.title} className="legal-section" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}>
              <h2>{s.title}</h2>
              <div className="legal-content">
                {s.content.split('\n').map((line, j) => (
                  line.startsWith('•')
                    ? <div key={j} className="legal-bullet"><span>•</span><span>{line.slice(2)}</span></div>
                    : line.trim() ? <p key={j}>{line}</p> : <br key={j} />
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
