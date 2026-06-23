import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';

const SECTIONS = [
  {
    title: '1. Information We Collect',
    content: `We may collect:
• Name
• Email address
• Phone number
• Shipping/billing address
• Payment details (processed securely via third-party providers)
• Uploaded artwork/designs
• Device/browser information`,
  },
  {
    title: '2. How We Use Your Information',
    content: `We use your information to:
• Process and fulfill orders
• Provide customer support
• Improve our products and website
• Send order updates
• Share promotional offers (only if opted-in)`,
  },
  {
    title: '3. Payment Security',
    content: `We do not store complete card or banking information on our servers. Payments are securely processed through trusted payment gateways.`,
  },
  {
    title: '4. Cookies',
    content: `We may use cookies and analytics tools to:
• Improve user experience
• Analyze website traffic
• Remember user preferences

You can disable cookies through your browser settings.`,
  },
  {
    title: '5. Sharing Information',
    content: `We do not sell your personal information.

Your data may be shared only with:
• Courier/logistics partners
• Payment gateway providers
• Service providers required to operate the business`,
  },
  {
    title: '6. Data Protection',
    content: `We implement reasonable security measures to protect user data from unauthorized access or misuse.`,
  },
  {
    title: '7. User Rights',
    content: `You may request:
• Access to your personal information
• Correction of inaccurate data
• Deletion of your information (subject to legal/business obligations)`,
  },
  {
    title: '8. Policy Updates',
    content: `We may update this Privacy Policy periodically. Continued use of the website indicates acceptance of updated policies.`,
  },
  {
    title: '9. Contact Us',
    content: `For privacy-related concerns:\n\nTheFramedWall\nEmail: theframedwall@gmail.com / admin@theframedwall.com`,
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="legal-page">
      <div className="container" style={{ maxWidth: 800 }}>
        <motion.div className="legal-header" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="legal-icon" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}><Shield size={28} /></div>
          <h1>Privacy Policy</h1>
          <p className="legal-updated">Last Updated: May 15, 2026</p>
          <p className="legal-intro">
            At TheFramedWall, we value your privacy and are committed to protecting your personal information.
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
