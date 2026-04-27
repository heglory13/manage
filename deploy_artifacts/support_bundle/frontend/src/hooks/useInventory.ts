import { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { InventoryPosition, PaginatedResponse } from '../services/api';

interface UseInventoryOptions {
  page?: number;
  limit?: number;
  warehouseId?: number;
  zoneId?: number;
  search?: string;
}

export function useInventory(options: UseInventoryOptions = {}) {
  const [data, setData] = useState<PaginatedResponse<InventoryPosition> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { page = 1, limit = 50, warehouseId, zoneId, search } = options;

  useEffect(() => {
    const fetchInventory = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
        });
        if (warehouseId) params.append('warehouseId', warehouseId.toString());
        if (zoneId) params.append('zoneId', zoneId.toString());
        if (search) params.append('search', search);

        const res = await api.get(`/inventory?${params}`);
        setData(res.data);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInventory();
  }, [page, limit, warehouseId, zoneId, search]);

  return { data, isLoading, error };
}

export function useCapacity() {
  const [data, setData] = useState<{ total: number; used: number; percentage: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get('/inventory/capacity')
      .then(res => setData(res.data))
      .finally(() => setIsLoading(false));
  }, []);

  return { data, isLoading };
}
