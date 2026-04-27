import { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { User } from '../services/api';

interface UseUsersOptions {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  isActive?: boolean;
}

export function useUsers(options: UseUsersOptions = {}) {
  const [data, setData] = useState<{ data: User[]; total: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { page = 1, limit = 20, search, role, isActive } = options;

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
        });
        if (search) params.append('search', search);
        if (role) params.append('role', role);
        if (isActive !== undefined) params.append('isActive', isActive.toString());

        const res = await api.get(`/users?${params}`);
        setData(res.data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [page, limit, search, role, isActive]);

  return { data, isLoading, error };
}
