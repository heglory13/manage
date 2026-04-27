import { useState } from 'react';
import { api } from '../services/api';

interface ReportData {
  type: string;
  data: any;
  generatedAt: string;
}

export function useReports() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const generateReport = async (type: string, params: Record<string, any> = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get(`/reports/${type}`, { params });
      return res.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const exportReport = async (type: string, format: 'pdf' | 'excel', params: Record<string, any> = {}) => {
    setIsLoading(true);
    try {
      const res = await api.get(`/reports/${type}/export?format=${format}`, {
        params,
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}-report.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { generateReport, exportReport, isLoading, error };
}
