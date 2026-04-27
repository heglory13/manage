import { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { ActivityLog } from '../services/api';

interface UseActivityLogsOptions {
  page?: number;
  limit?: number;
  entityType?: string;
  userId?: number;
  startDate?: string;
  endDate?: string;
}

export function useActivityLogs(options: UseActivityLogsOptions = {}) {
  const [data, setData] = useState<{ data: ActivityLog[]; total: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { page = 1, limit = 50, entityType, userId, startDate, endDate } = options;

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
        });
        if (entityType) params.append('entityType', entityType);
        if (userId) params.append('userId', userId.toString());
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);

        const res = await api.get(`/activity-logs?${params}`);
        setData(res.data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, [page, limit, entityType, userId, startDate, endDate]);

  return { data, isLoading, error };
}
