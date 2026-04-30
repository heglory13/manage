import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface InputDeclaration {
  id: number;
  code: string;
  warehouseId: number;
  warehouseName: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  classifications?: { id: number; name: string }[];
  colors?: { id: number; name: string; code: string }[];
  sizes?: { id: number; name: string }[];
}

export function useInputDeclarations(options: { page?: number; warehouseId?: number; status?: string } = {}) {
  const { page = 1, warehouseId, status } = options;
  const [data, setData] = useState<{ data: InputDeclaration[]; total: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchDeclarations = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ page: page.toString() });
        if (warehouseId) params.append('warehouseId', warehouseId.toString());
        if (status) params.append('status', status);

        const res = await api.get(`/input-declarations?${params}`);
        setData(res.data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDeclarations();
  }, [page, warehouseId, status]);

  return { data, isLoading, error };
}
