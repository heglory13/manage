import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface DashboardData {
  totalProducts: number;
  totalInventory: number;
  lowStockCount: number;
  totalWarehouses: number;
  pendingStocktaking: number;
  recentActivity: { id: number; action: string; entityType: string; userName: string; createdAt: string }[];
}

export function useDashboard(period: string = 'month') {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    api.get(`/dashboard?period=${period}`)
      .then(res => setData(res.data))
      .catch(err => setError(err as Error))
      .finally(() => setIsLoading(false));
  }, [period]);

  return { data, isLoading, error };
}
