import { Link } from 'react-router-dom';
import { Heart, Twitter, Instagram, Mail, Youtube, Facebook } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-grid">
          <div className="footer-col">
            <div className="footer-brand">
              <div className="brand-icon">T</div>
              <span>TheFramedWall</span>
            </div>
            <p className="footer-desc">
              India's #1 custom print-on-demand platform. Design personalised t-shirts, mugs, canvas prints, and more — delivered pan-India.
            </p>
            <div className="social-links">
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><Instagram size={18} /></a>
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><Facebook size={18} /></a>
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube"><Youtube size={18} /></a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter"><Twitter size={18} /></a>
              <a href="mailto:hello@theframedwall.com" aria-label="Email"><Mail size={18} /></a>
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
            <Link to="/corporate">Corporate Orders</Link>
            <Link to="/faq">FAQ</Link>
            <Link to="/faq">Privacy Policy</Link>
            <Link to="/faq">Terms of Service</Link>
          </div>

          <div className="footer-col">
            <h4>Help</h4>
            <Link to="/faq">Shipping Info</Link>
            <Link to="/faq">Returns & Refunds</Link>
            <Link to="/faq">Size Guide</Link>
            <Link to="/orders">Track Order</Link>
            <a href="https://wa.me/919876543210" target="_blank" rel="noopener noreferrer">WhatsApp Support</a>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} TheFramedWall. Made with <Heart size={14} className="heart" /> in India. All rights reserved.</p>
          <p className="footer-bottom-info">GST Registration: 06AABCT3518Q1ZX &nbsp;|&nbsp; Haryana, India</p>
        </div>
      </div>
    </footer>
  );
}
