export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface Task {
  id: string;
  workflow_instance_id: string;
  /** Joined from workflow_instances when listing/fetching tasks */
  document_id?: string | null;
  step_number: number;
  assignee_id: string;
  status: TaskStatus;
  due_date?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskRequest {
  workflow_instance_id: string;
  step_number: number;
  assignee_id: string;
  due_date?: string;
}

export interface UpdateTaskRequest {
  status?: TaskStatus;
  due_date?: string;
}
