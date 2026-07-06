import { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Product, PaginatedResponse } from '../services/api';

interface UseProductsOptions {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: number;
  isActive?: boolean;
}

export function useProducts(options: UseProductsOptions = {}) {
  const [data, setData] = useState<PaginatedResponse<Product> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { page = 1, limit = 20, search, categoryId, isActive } = options;

  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
        });
        if (search) params.append('search', search);
        if (categoryId) params.append('categoryId', categoryId.toString());
        if (isActive !== undefined) params.append('isActive', isActive.toString());

        const res = await api.get(`/products?${params}`);
        setData(res.data);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [page, limit, search, categoryId, isActive]);

  const refetch = () => {
    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
        });
        if (search) params.append('search', search);
        if (categoryId) params.append('categoryId', categoryId.toString());
        if (isActive !== undefined) params.append('isActive', isActive.toString());

        const res = await api.get(`/products?${params}`);
        setData(res.data);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();
  };

  return { data, isLoading, error, refetch };
}
