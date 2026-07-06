import { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { ActivityLog } from '../services/api';

interface UseActivityLogsOptions {
  page?: number;
  limit?: number;
  tableName?: string;
  userId?: string;
  action?: string;
  keyword?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function useActivityLogs(options: UseActivityLogsOptions = {}) {
  const [data, setData] = useState<{ data: ActivityLog[]; total: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { page = 1, limit = 50, tableName, userId, action, keyword, dateFrom, dateTo } = options;

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const params: Record<string, string> = {
          page: page.toString(),
          limit: limit.toString(),
        };
        if (keyword) params.keyword = keyword;
        if (action) params.action = action;
        if (userId) params.userId = userId;
        if (tableName) params.tableName = tableName;
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;

        const res = await api.get('/activity-logs', { params });
        setData(res.data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, [page, limit, tableName, userId, action, keyword, dateFrom, dateTo]);

  return { data, isLoading, error };
}
