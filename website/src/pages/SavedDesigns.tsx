import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Palette, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { api } from '../api';

interface SavedDesign {
  id: string;
  name: string;
  productType: string;
  colorHex: string;
  colorName: string;
  printSize: string;
  thumbnail: string;
  createdAt: string;
}

export default function SavedDesigns() {
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSavedDesigns()
      .then((data) => setDesigns(data))
      .catch(() => toast.error('Failed to load saved designs'))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this saved design?')) return;
    try {
      await api.deleteSavedDesign(id);
      setDesigns((prev) => prev.filter((d) => d.id !== id));
      toast.success('Design deleted');
    } catch {
      toast.error('Failed to delete design');
    }
  };

  return (
    <div className="orders-page">
      <div className="orders-container">
        <h1 className="orders-title">Saved Designs</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Your saved design studio creations
        </p>

        {loading ? (
          <div className="orders-loading">
            <div className="spinner" />
            <p>Loading saved designs...</p>
          </div>
        ) : designs.length === 0 ? (
          <div className="empty-orders">
            <Palette size={48} />
            <h2>No saved designs yet</h2>
            <p>Create custom designs in the Design Studio and save them here.</p>
            <Link to="/design-studio" className="btn btn-primary">Open Design Studio</Link>
          </div>
        ) : (
          <div className="saved-designs-grid">
            <AnimatePresence>
              {designs.map((d) => (
                <motion.div
                  key={d.id}
                  className="saved-design-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  layout
                >
                  <div className="sd-thumbnail">
                    {d.thumbnail ? (
                      <img src={d.thumbnail} alt={d.name} />
                    ) : (
                      <div className="sd-placeholder"><Palette size={32} /></div>
                    )}
                  </div>
                  <div className="sd-info">
                    <h3 className="sd-name">{d.name}</h3>
                    <span className="sd-product">{d.productType}</span>
                    <div className="sd-meta">
                      <span className="sd-color" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: 14, height: 14, borderRadius: '50%', background: d.colorHex, border: '1px solid var(--border)', display: 'inline-block' }} />
                        {d.colorName}
                      </span>
                      <span className="sd-size">{d.printSize}</span>
                    </div>
                    <span className="sd-date">
                      <Calendar size={12} /> {new Date(d.createdAt).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                  <div className="sd-actions">
                    <Link to="/design-studio" className="btn btn-sm btn-primary">Edit</Link>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(d.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
