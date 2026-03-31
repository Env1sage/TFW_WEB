import { useState, useEffect } from 'react';
import type { Product } from '../types';
import { fetchAllProducts } from '../api';
import Designer from '../components/Designer';

export default function CustomerDesigner() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllProducts()
      .then((prods) => {
        setProducts(prods);
        if (prods.length > 0) setSelectedProduct(prods[0]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading products...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-screen">
        <h2>Failed to load</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (!selectedProduct) {
    return (
      <div className="error-screen">
        <h2>No products found</h2>
        <p>Create a product via the admin API first.</p>
      </div>
    );
  }

  return (
    <Designer
      product={selectedProduct}
      allProducts={products}
      onSwitchProduct={(p) => setSelectedProduct(p)}
    />
  );
}
