export interface CategoryReportCount {
  categoryId: string;
  categoryName: string;
  count: number;
  percentage: number;
  color: string;
}

export interface ReportStats {
  totalSyncedReports: number;
  totalPendingReports: number;
  reportsByCategory: CategoryReportCount[];
}
