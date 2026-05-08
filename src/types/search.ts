export interface SearchRequest {
  query: string;
  size?: number;
  from?: number;
}

export interface SearchHit {
  id: string;
  score: number;
  title: string;
  content?: string;
  status?: string;
  owner_id?: string;
}

export interface SearchResponse {
  total: number;
  hits: SearchHit[];
}

export interface IndexDocumentRequest {
  id: string;
  title: string;
  content?: string;
  status?: string;
  owner_id?: string;
}

export interface OcrResponse {
  filename: string;
  mimetype: string;
  text: string;
}
