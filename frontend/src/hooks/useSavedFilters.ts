import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

interface SavedFilter {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  createdAt: string;
}

interface UseSavedFiltersOptions {
  pageKey: string;
  onFiltersChange?: (filters: Record<string, unknown>) => void;
}

export function useSavedFilters({ pageKey, onFiltersChange }: UseSavedFiltersOptions) {
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch saved filters
  const fetchSavedFilters = useCallback(async () => {
    try {
      const res = await api.get('/saved-filters', { params: { pageKey } });
      setSavedFilters(res.data || []);
    } catch (err) {
      console.error('Error fetching saved filters:', err);
    }
  }, [pageKey]);

  useEffect(() => {
    fetchSavedFilters();
  }, [fetchSavedFilters]);

  // Apply a saved filter
  const applyFilter = useCallback((filter: SavedFilter) => {
    setActiveFilterId(filter.id);
    setFilters(filter.filters as Record<string, unknown>);
    onFiltersChange?.(filter.filters as Record<string, unknown>);
  }, [onFiltersChange]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setActiveFilterId(null);
    setFilters({});
    onFiltersChange?.({});
  }, [onFiltersChange]);

  // Save current filters
  const saveFilter = useCallback(async (name: string) => {
    setIsLoading(true);
    try {
      const res = await api.post('/saved-filters', {
        pageKey,
        name,
        filters,
      });
      await fetchSavedFilters();
      setActiveFilterId(res.data.id);
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể lưu bộ lọc';
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [filters, pageKey, fetchSavedFilters]);

  // Delete a saved filter
  const deleteFilter = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      await api.delete(`/saved-filters/${id}`);
      if (activeFilterId === id) {
        setActiveFilterId(null);
      }
      await fetchSavedFilters();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể xóa bộ lọc';
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeFilterId, fetchSavedFilters]);

  // Update a single filter
  const updateFilter = useCallback((key: string, value: unknown) => {
    setFilters(prev => {
      const updated = { ...prev, [key]: value };
      onFiltersChange?.(updated);
      return updated;
    });
    setActiveFilterId(null); // Clear active saved filter when manually changing filters
  }, [onFiltersChange]);

  // Remove a single filter
  const removeFilter = useCallback((key: string) => {
    setFilters(prev => {
      const updated = { ...prev };
      delete updated[key];
      onFiltersChange?.(updated);
      return updated;
    });
    setActiveFilterId(null);
  }, [onFiltersChange]);

  return {
    filters,
    savedFilters,
    activeFilterId,
    isLoading,
    applyFilter,
    clearFilters,
    saveFilter,
    deleteFilter,
    updateFilter,
    removeFilter,
  };
}
