export interface Pagination {
  size: number;
  page: number;
}

export interface PaginationResponse<T = any> {
  total: number;
  page: number;
  size: number;
  totalPages: number;
  data: T[];
}
