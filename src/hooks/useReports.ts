import { useState, useEffect, useCallback } from 'react';
import { reportService } from '../services';
import type { Report } from '../models';

export function useReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const data = await reportService.getReports();
      setReports(data);
    } catch (error) {
      console.error('[useReports] Failed to fetch reports from local repository:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return {
    reports,
    loading,
    refresh: fetchReports,
  };
}
