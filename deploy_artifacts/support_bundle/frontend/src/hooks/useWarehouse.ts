import { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Warehouse, PaginatedResponse } from '../services/api';

interface UseWarehouseOptions {
  page?: number;
  limit?: number;
  search?: string;
}

export function useWarehouse(options: UseWarehouseOptions = {}) {
  const [data, setData] = useState<PaginatedResponse<Warehouse> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { page = 1, limit = 20, search } = options;

  useEffect(() => {
    const fetchWarehouse = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
        });
        if (search) params.append('search', search);

        const res = await api.get(`/warehouse?${params}`);
        setData(res.data);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWarehouse();
  }, [page, limit, search]);

  return { data, isLoading, error };
}

export function useWarehouseDetail(id: number | string) {
  const [data, setData] = useState<Warehouse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    api.get(`/warehouse/${id}`)
      .then(res => setData(res.data))
      .catch(err => setError(err as Error))
      .finally(() => setIsLoading(false));
  }, [id]);

  return { data, isLoading, error };
}
