import { useState } from 'react';
import { api } from '../services/api';

interface PreliminaryCheck {
  id: number;
  stocktakingId: number;
  type: 'PRELIMINARY' | 'DETAILED';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  checkedPositions: number;
  totalPositions: number;
  discrepancies: number;
  createdAt: string;
  completedAt?: string;
}

export function usePreliminaryCheck(stocktakingId?: number) {
  const [data, setData] = useState<PreliminaryCheck | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const startCheck = async (type: 'PRELIMINARY' | 'DETAILED') => {
    if (!stocktakingId) return;
    setIsLoading(true);
    try {
      const res = await api.post(`/stocktaking/${stocktakingId}/checks`, { type });
      setData(res.data);
      return res.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateCheckProgress = async (checkId: number, positionId: number, quantity: number, notes?: string) => {
    try {
      const res = await api.patch(`/stocktaking/checks/${checkId}/positions/${positionId}`, { quantity, notes });
      setData(prev => prev ? { ...prev, checkedPositions: prev.checkedPositions + 1, discrepancies: res.data.hasDiscrepancy ? prev.discrepancies + 1 : prev.discrepancies } : null);
      return res.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const completeCheck = async (checkId: number) => {
    try {
      const res = await api.post(`/stocktaking/checks/${checkId}/complete`);
      setData(res.data);
      return res.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const getCheckDetails = async (checkId: number) => {
    setIsLoading(true);
    try {
      const res = await api.get(`/stocktaking/checks/${checkId}`);
      setData(res.data);
      return res.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { data, isLoading, error, startCheck, updateCheckProgress, completeCheck, getCheckDetails };
}
