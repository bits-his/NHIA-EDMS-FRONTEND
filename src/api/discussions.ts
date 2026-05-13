import { documentClient } from './client';

/**
 * Lightweight directory entry returned by the discussion picker — anyone who
 * already has access to the underlying document is eligible to be added as a
 * participant of a side-conversation.
 */
export interface DiscussionEligibleParticipant {
  id: string;
  username: string;
  full_name?: string | null;
  email?: string | null;
  rank?: string | null;
  department?: string | null;
  role_description?: string | null;
  role_name?: string | null;
}

export interface DiscussionThreadSummary {
  id: string;
  document_id: string;
  created_by: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  message_count: number;
  participant_count: number;
}

export interface DiscussionParticipant {
  id: string;
  discussion_id: string;
  user_id: string;
  created_at: string;
  user_full_name?: string | null;
  user_username?: string | null;
  user_rank?: string | null;
  user_department?: string | null;
  user_role_description?: string | null;
  user_role_name?: string | null;
}

export interface DiscussionMessage {
  id: string;
  discussion_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender_full_name?: string | null;
  sender_username?: string | null;
  sender_rank?: string | null;
  sender_department?: string | null;
  sender_role_description?: string | null;
  sender_role_name?: string | null;
}

export interface CreateDiscussionResponse {
  discussion: DiscussionThreadSummary;
  participants: DiscussionParticipant[];
  message: DiscussionMessage | null;
}

export const discussionsApi = {
  listEligibleParticipants: async (
    documentId: string
  ): Promise<DiscussionEligibleParticipant[]> => {
    const res = await documentClient.get<DiscussionEligibleParticipant[]>(
      `/documents/${documentId}/discussions/eligible-participants`
    );
    return res.data;
  },

  list: async (documentId: string): Promise<DiscussionThreadSummary[]> => {
    const res = await documentClient.get<DiscussionThreadSummary[]>(
      `/documents/${documentId}/discussions`
    );
    return res.data;
  },

  create: async (
    documentId: string,
    payload: {
      title?: string;
      participant_user_ids: string[];
      initial_message?: string;
    }
  ): Promise<CreateDiscussionResponse> => {
    const res = await documentClient.post<CreateDiscussionResponse>(
      `/documents/${documentId}/discussions`,
      payload
    );
    return res.data;
  },

  get: async (
    documentId: string,
    threadId: string
  ): Promise<DiscussionThreadSummary & { participants: DiscussionParticipant[] }> => {
    const res = await documentClient.get<
      DiscussionThreadSummary & { participants: DiscussionParticipant[] }
    >(`/documents/${documentId}/discussions/${threadId}`);
    return res.data;
  },

  listMessages: async (
    documentId: string,
    threadId: string
  ): Promise<DiscussionMessage[]> => {
    const res = await documentClient.get<DiscussionMessage[]>(
      `/documents/${documentId}/discussions/${threadId}/messages`
    );
    return res.data;
  },

  sendMessage: async (
    documentId: string,
    threadId: string,
    body: string
  ): Promise<DiscussionMessage> => {
    const res = await documentClient.post<DiscussionMessage>(
      `/documents/${documentId}/discussions/${threadId}/messages`,
      { body }
    );
    return res.data;
  },

  addParticipant: async (
    documentId: string,
    threadId: string,
    userId: string
  ): Promise<DiscussionParticipant[]> => {
    const res = await documentClient.post<DiscussionParticipant[]>(
      `/documents/${documentId}/discussions/${threadId}/participants`,
      { user_id: userId }
    );
    return res.data;
  },
};
