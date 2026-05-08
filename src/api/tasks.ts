import { taskClient } from './client';
import type { Task, CreateTaskRequest, UpdateTaskRequest } from '@/types/task';

export const tasksApi = {
  create: async (data: CreateTaskRequest): Promise<Task> => {
    const res = await taskClient.post<Task>('/tasks', data);
    return res.data;
  },

  list: async (assigneeId: string): Promise<Task[]> => {
    const res = await taskClient.get<Task[]>('/tasks', {
      params: { assignee_id: assigneeId },
    });
    return res.data;
  },

  getById: async (id: string): Promise<Task> => {
    const res = await taskClient.get<Task>(`/tasks/${id}`);
    return res.data;
  },

  update: async (id: string, data: UpdateTaskRequest): Promise<Task> => {
    const res = await taskClient.put<Task>(`/tasks/${id}`, data);
    return res.data;
  },

  complete: async (id: string): Promise<Task> => {
    const res = await taskClient.post<Task>(`/tasks/${id}/complete`);
    return res.data;
  },
};
