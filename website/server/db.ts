import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'db.json');

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'user' | 'admin';
  twoFactorSecret?: string;
  twoFactorEnabled: boolean;
  avatar?: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  images: string[];
  customizable: boolean;
  colors: string[];
  sizes: string[];
  stock: number;
  rating: number;
  reviewCount: number;
  featured: boolean;
  createdAt: string;
}

export interface Order {
  id: string;
  userId: string;
  items: { productId: string; quantity: number; color?: string; size?: string; customText?: string; price: number }[];
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shippingAddress: string;
  createdAt: string;
}

interface DB {
  users: User[];
  products: Product[];
  orders: Order[];
}

function load(): DB {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    }
  } catch { /* ignore */ }
  return { users: [], products: [], orders: [] };
}

let data = load();

function save() {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

export const db = {
  get users() { return data.users; },
  get products() { return data.products; },
  get orders() { return data.orders; },

  addUser(u: User) { data.users.push(u); save(); },
  updateUser(id: string, patch: Partial<User>) {
    const i = data.users.findIndex(u => u.id === id);
    if (i >= 0) { data.users[i] = { ...data.users[i], ...patch }; save(); }
    return data.users[i];
  },
  findUserByEmail(email: string) { return data.users.find(u => u.email === email); },
  findUserById(id: string) { return data.users.find(u => u.id === id); },

  addProduct(p: Product) { data.products.push(p); save(); },
  updateProduct(id: string, patch: Partial<Product>) {
    const i = data.products.findIndex(p => p.id === id);
    if (i >= 0) { data.products[i] = { ...data.products[i], ...patch }; save(); }
    return data.products[i];
  },
  deleteProduct(id: string) {
    data.products = data.products.filter(p => p.id !== id);
    save();
  },

  addOrder(o: Order) { data.orders.push(o); save(); },
  updateOrder(id: string, patch: Partial<Order>) {
    const i = data.orders.findIndex(o => o.id === id);
    if (i >= 0) { data.orders[i] = { ...data.orders[i], ...patch }; save(); }
    return data.orders[i];
  },

  seed() {
    if (data.products.length > 0) return;
    const categories = ['T-Shirts', 'Hoodies', 'Mugs', 'Phone Cases', 'Posters', 'Canvas', 'Stickers', 'Tote Bags'];
    const sampleProducts: Omit<Product, 'id' | 'createdAt'>[] = [
      { name: 'Classic Custom T-Shirt', description: 'Premium cotton t-shirt with your custom design. Soft, comfortable, and perfect for everyday wear.', price: 24.99, category: 'T-Shirts', image: '/placeholders/tshirt.svg', images: [], customizable: true, colors: ['#ffffff', '#1a1a1a', '#1b2a4a', '#c0392b', '#2d5a3d'], sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], stock: 150, rating: 4.8, reviewCount: 234, featured: true },
      { name: 'Premium Custom Hoodie', description: 'Cozy fleece-lined hoodie with custom print. Warm, stylish, and uniquely yours.', price: 44.99, category: 'Hoodies', image: '/placeholders/hoodie.svg', images: [], customizable: true, colors: ['#1a1a1a', '#1b2a4a', '#36454f', '#6b1c23', '#ffffff'], sizes: ['S', 'M', 'L', 'XL', 'XXL'], stock: 80, rating: 4.7, reviewCount: 156, featured: true },
      { name: 'Personalized Ceramic Mug', description: 'High-quality 11oz ceramic mug with vibrant custom print. Dishwasher & microwave safe.', price: 14.99, category: 'Mugs', image: '/placeholders/mug.svg', images: [], customizable: true, colors: ['#ffffff'], sizes: ['11oz', '15oz'], stock: 200, rating: 4.9, reviewCount: 312, featured: true },
      { name: 'Custom Phone Case', description: 'Slim-fit protective phone case with your design. Impact-resistant and scratch-proof.', price: 19.99, category: 'Phone Cases', image: '/placeholders/phone-case.svg', images: [], customizable: true, colors: ['#ffffff', '#1a1a1a', '#87ceeb'], sizes: ['iPhone 14', 'iPhone 15', 'iPhone 16', 'Samsung S24', 'Pixel 8'], stock: 120, rating: 4.6, reviewCount: 189, featured: false },
      { name: 'Custom Art Poster', description: 'Museum-quality poster printed on thick, durable matte paper. Perfect for any room.', price: 18.99, category: 'Posters', image: '/placeholders/poster.svg', images: [], customizable: true, colors: [], sizes: ['12x16', '18x24', '24x36'], stock: 300, rating: 4.8, reviewCount: 267, featured: true },
      { name: 'Canvas Print', description: 'Gallery-wrapped canvas with your custom artwork. Ready to hang with a modern edge.', price: 39.99, category: 'Canvas', image: '/placeholders/canvas.svg', images: [], customizable: true, colors: [], sizes: ['8x10', '16x20', '24x36', '30x40'], stock: 60, rating: 4.9, reviewCount: 98, featured: true },
      { name: 'Custom Vinyl Stickers', description: 'Weather-resistant vinyl sticker pack with your designs. Perfect for laptops, bottles, and more.', price: 8.99, category: 'Stickers', image: '/placeholders/sticker.svg', images: [], customizable: true, colors: [], sizes: ['3 Pack', '6 Pack', '12 Pack'], stock: 500, rating: 4.7, reviewCount: 421, featured: false },
      { name: 'Custom Tote Bag', description: 'Durable cotton tote with custom print. Eco-friendly and stylish for everyday use.', price: 16.99, category: 'Tote Bags', image: '/placeholders/tote-bag.svg', images: [], customizable: true, colors: ['#ffffff', '#1a1a1a', '#c2b280'], sizes: ['Standard'], stock: 100, rating: 4.5, reviewCount: 143, featured: false },
      { name: 'All-Over Print Tee', description: 'Full sublimation print t-shirt. Your design wraps around the entire shirt for maximum impact.', price: 34.99, category: 'T-Shirts', image: '/placeholders/tshirt.svg', images: [], customizable: true, colors: [], sizes: ['S', 'M', 'L', 'XL'], stock: 70, rating: 4.6, reviewCount: 87, featured: false },
      { name: 'Custom Zip Hoodie', description: 'Full-zip hoodie with custom design. Perfect layering piece for any season.', price: 52.99, category: 'Hoodies', image: '/placeholders/hoodie.svg', images: [], customizable: true, colors: ['#1a1a1a', '#36454f', '#1b2a4a'], sizes: ['S', 'M', 'L', 'XL', 'XXL'], stock: 55, rating: 4.8, reviewCount: 67, featured: false },
      { name: 'Travel Mug', description: 'Stainless steel insulated travel mug with custom print. Keeps drinks hot for 12 hours.', price: 22.99, category: 'Mugs', image: '/placeholders/mug.svg', images: [], customizable: true, colors: ['#ffffff', '#1a1a1a'], sizes: ['16oz', '20oz'], stock: 90, rating: 4.7, reviewCount: 134, featured: false },
      { name: 'Framed Art Print', description: 'Custom art in a sleek modern frame. Premium paper with vivid color reproduction.', price: 49.99, category: 'Canvas', image: '/placeholders/canvas.svg', images: [], customizable: true, colors: [], sizes: ['8x10', '11x14', '16x20'], stock: 45, rating: 4.9, reviewCount: 76, featured: true },
    ];
    sampleProducts.forEach((p, i) => {
      data.products.push({ ...p, id: `prod_${i + 1}`, createdAt: new Date().toISOString() });
    });
    // Create default admin user (password: admin123)
    // Hash generated with bcryptjs for "admin123"
    save();
    console.log(`Seeded ${data.products.length} products`);
  },
};
