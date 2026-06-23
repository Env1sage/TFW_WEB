import { Link } from 'react-router-dom';
import { Twitter, Instagram, Mail, Youtube, Facebook } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-grid">
          <div className="footer-col">
            <div className="footer-brand footer-brand-link">
              <div className="brand-icon">T</div>
              <span>TheFramedWall</span>
            </div>
            <p className="footer-motto">
              "If You Can Think It,&nbsp;<span className="motto-ink">We Can Ink It</span>"
            </p>
            <p className="footer-desc">
              India's #1 custom print-on-demand platform. Design personalised t-shirts, mugs, canvas prints, and more — delivered pan-India.
            </p>
            <div className="social-links" style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="social-link-anim sl-instagram">
                <Instagram size={17} />
              </a>
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="social-link-anim sl-facebook">
                <Facebook size={17} />
              </a>
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="social-link-anim sl-youtube">
                <Youtube size={17} />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="social-link-anim sl-twitter">
                <Twitter size={17} />
              </a>
              <a href="mailto:hello@theframedwall.com" aria-label="Email" className="social-link-anim sl-mail">
                <Mail size={17} />
              </a>
            </div>
          </div>

          <div className="footer-col">
            <h4>Shop</h4>
            <Link to="/products?category=T-Shirts">T-Shirts</Link>
            <Link to="/products?category=Hoodies">Hoodies</Link>
            <Link to="/products?category=Mugs">Mugs</Link>
            <Link to="/products?category=Posters">Posters</Link>
            <Link to="/products?category=Canvas">Canvas Prints</Link>
            <Link to="/products?category=Stickers">Stickers</Link>
          </div>

          <div className="footer-col">
            <h4>Company</h4>
            <Link to="/about">About Us</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/collections">Collections</Link>
            <Link to="/corporate">Corporate Orders</Link>
            <Link to="/faq">FAQ</Link>
          </div>

          <div className="footer-col">
            <h4>Legal &amp; Help</h4>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/refund">Refund Policy</Link>
            <Link to="/faq">Shipping Info</Link>
            <Link to="/orders">Track Order</Link>
            <a href="https://wa.me/918983301235" target="_blank" rel="noopener noreferrer">WhatsApp Support</a>
          </div>
        </div>

        <div className="footer-bottom">
          <p>
            &copy; {new Date().getFullYear()} TheFramedWall. Made with&nbsp;
            <span className="heart-beat" aria-hidden="true">❤️</span>
            &nbsp;in India. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
