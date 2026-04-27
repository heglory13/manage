import { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Stocktaking, PaginatedResponse } from '../services/api';

interface UseStocktakingOptions {
  page?: number;
  limit?: number;
  warehouseId?: number;
  status?: string;
}

export function useStocktaking(options: UseStocktakingOptions = {}) {
  const [data, setData] = useState<PaginatedResponse<Stocktaking> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { page = 1, limit = 20, warehouseId, status } = options;

  useEffect(() => {
    const fetchStocktaking = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
        });
        if (warehouseId) params.append('warehouseId', warehouseId.toString());
        if (status) params.append('status', status);

        const res = await api.get(`/stocktaking?${params}`);
        setData(res.data);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStocktaking();
  }, [page, limit, warehouseId, status]);

  return { data, isLoading, error };
}

export function useStocktakingDetail(id: number | string) {
  const [data, setData] = useState<Stocktaking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    api.get(`/stocktaking/${id}`)
      .then(res => setData(res.data))
      .catch(err => setError(err as Error))
      .finally(() => setIsLoading(false));
  }, [id]);

  return { data, isLoading, error };
}
