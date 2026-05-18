import { documentClient } from './client';
import type { DashboardHomeResponse } from '@/types/dashboard';

export type DashboardPeriodParams = {
  from: string;
  to: string;
};

export const dashboardApi = {
  getHome: async (params?: DashboardPeriodParams): Promise<DashboardHomeResponse> => {
    const res = await documentClient.get<DashboardHomeResponse>('/documents/dashboard/home', {
      params,
    });
    return res.data;
  },
};
