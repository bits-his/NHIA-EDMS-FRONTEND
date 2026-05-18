import type { Document } from '@/types/document';

export type RegistryScope = 'organisation' | 'own';

export type RegistryListResponse = {
  scope: RegistryScope;
  label: string;
  documents: Document[];
};

export type RegistrySearchFilters = {
  keyword?: string;
  ref_number?: string;
  date_from?: string;
  date_to?: string;
  category?: string;
  status?: string;
};
