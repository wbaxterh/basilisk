/**
 * API / transport types — request/response envelopes, pagination, errors.
 * Used by the API gateway and all clients.
 */

/** Standard API success response. */
export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

/** Standard API error response. */
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/** Pagination metadata. */
export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

/** Pagination query params. */
export interface PaginationParams {
  page?: number;
  perPage?: number;
}

/** Sort direction. */
export type SortDirection = "asc" | "desc";

/** WebSocket event envelope. */
export interface WsEvent<T = unknown> {
  type: string;
  channel: string;
  data: T;
  timestamp: number;
}
