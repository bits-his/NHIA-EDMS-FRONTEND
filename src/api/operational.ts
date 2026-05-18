import { documentClient } from './client';
import type { PersonalOperationalDashboard, TeamOperationalVisibility } from '@/types/operational';

export const operationalApi = {
  getPersonal: async (params?: Record<string, string>): Promise<PersonalOperationalDashboard> => {
    const res = await documentClient.get<PersonalOperationalDashboard>(
      '/documents/operational/personal',
      { params }
    );
    return res.data;
  },

  getTeam: async (params?: Record<string, string>): Promise<TeamOperationalVisibility> => {
    const res = await documentClient.get<TeamOperationalVisibility>('/documents/operational/team', {
      params,
    });
    return res.data;
  },
};
