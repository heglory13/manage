import { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { api } from '../services/api';
import { formatNumber } from '../lib/utils';
import { plus, edit, trash, download } from '../components/icons';

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', sku: '', price: 0, stock: 0, minThreshold: 0, categoryId: '' });
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/products');
      setProducts(res.data.data || res.data);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await api.patch(`/products/${editingProduct.id}`, formData);
      } else {
        await api.post('/products', formData);
      }
      setShowModal(false);
      setEditingProduct(null);
      setFormData({ name: '', sku: '', price: 0, stock: 0, minThreshold: 0, categoryId: '' });
      fetchProducts();
    } catch (err) {
      console.error('Error saving product:', err);
    }
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku,
      price: product.price,
      stock: product.stock,
      minThreshold: product.minThreshold || 0,
      categoryId: product.categoryId,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc muốn xóa sản phẩm này?')) {
      try {
        await api.delete(`/products/${id}`);
        fetchProducts();
      } catch (err) {
        console.error('Error deleting product:', err);
      }
    }
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Sản phẩm</h1>
        <button className="btn btn-primary" onClick={() => { setEditingProduct(null); setFormData({ name: '', sku: '', price: 0, stock: 0, minThreshold: 0, categoryId: '' }); setShowModal(true); }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={plus} /></svg>
          Thêm sản phẩm
        </button>
      </div>

      <div className="card">
        <div className="card-body">
          {isLoading ? (
            <div className="flex items-center justify-center h-48"><div className="spinner" style={{ borderTopColor: '#0d6efd' }}></div></div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Tên sản phẩm</th>
                    <th>Danh mục</th>
                    <th className="text-right">Giá</th>
                    <th className="text-right">Tồn kho</th>
                    <th className="text-right">Ngưỡng</th>
                    <th className="text-center">Trạng thái</th>
                    <th className="text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className="font-medium">{p.sku}</td>
                      <td>{p.name}</td>
                      <td>{p.category?.name || '-'}</td>
                      <td className="text-right">{formatNumber(p.price)}đ</td>
                      <td className="text-right">{formatNumber(p.stock)}</td>
                      <td className="text-right">{formatNumber(p.minThreshold || 0)}</td>
                      <td className="text-center">
                        <span className={`badge ${p.isDiscontinued ? 'badge-danger' : 'badge-success'}`}>
                          {p.isDiscontinued ? 'Ngừng' : 'Hoạt động'}
                        </span>
                      </td>
                      <td className="text-center">
                        <button className="btn btn-outline btn-sm" onClick={() => handleEdit(p)} style={{ marginRight: '4px' }}>
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={edit} /></svg>
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => handleDelete(p.id)}>
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={trash} /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr><td colSpan={8} className="text-center">Không có sản phẩm nào</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingProduct ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">SKU *</label>
                  <input type="text" className="form-control" value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} required disabled={!!editingProduct} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tên sản phẩm *</label>
                  <input type="text" className="form-control" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Danh mục</label>
                  <select className="form-select" value={formData.categoryId} onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}>
                    <option value="">Chọn danh mục</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Giá</label>
                    <input type="number" className="form-control" value={formData.price} onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tồn kho</label>
                    <input type="number" className="form-control" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Ngưỡng tối thiểu</label>
                  <input type="number" className="form-control" value={formData.minThreshold} onChange={(e) => setFormData({ ...formData, minThreshold: Number(e.target.value) })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">{editingProduct ? 'Lưu' : 'Thêm'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
