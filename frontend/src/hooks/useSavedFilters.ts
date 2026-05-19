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

function areFiltersEqual(a: Record<string, unknown>, b: Record<string, unknown>) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => {
    const av = a[key];
    const bv = b[key];
    if (Array.isArray(av) && Array.isArray(bv)) {
      return av.length === bv.length && av.every((v, i) => v === bv[i]);
    }
    return av === bv;
  });
}

export function useSavedFilters({ pageKey, onFiltersChange }: UseSavedFiltersOptions) {
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const [draftFilters, setDraftFilters] = useState<Record<string, unknown>>({});
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
    const nextFilters = filter.filters as Record<string, unknown>;
    setFilters(nextFilters);
    setDraftFilters(nextFilters);
    onFiltersChange?.(nextFilters);
  }, [onFiltersChange]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setActiveFilterId(null);
    setFilters({});
    setDraftFilters({});
    onFiltersChange?.({});
  }, [onFiltersChange]);

  const applyDraftFilters = useCallback(() => {
    setFilters(draftFilters);
    onFiltersChange?.(draftFilters);
  }, [draftFilters, onFiltersChange]);

  // Save current filters
  const saveFilter = useCallback(async (name: string) => {
    setIsLoading(true);
    try {
      const res = await api.post('/saved-filters', {
        pageKey,
        name,
        filters: draftFilters,
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
  }, [draftFilters, pageKey, fetchSavedFilters]);

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
    setDraftFilters(prev => {
      const updated = { ...prev, [key]: value };
      return updated;
    });
    setActiveFilterId(null); // Clear active saved filter when manually changing filters
  }, []);

  // Remove a single filter
  const removeFilter = useCallback((key: string) => {
    setDraftFilters(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
    setActiveFilterId(null);
  }, []);

  return {
    filters,
    draftFilters,
    savedFilters,
    activeFilterId,
    isLoading,
    hasPendingChanges: !areFiltersEqual(filters, draftFilters),
    applyFilter,
    clearFilters,
    applyDraftFilters,
    saveFilter,
    deleteFilter,
    updateFilter,
    removeFilter,
  };
}
