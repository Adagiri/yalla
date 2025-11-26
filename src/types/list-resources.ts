import { Model, Document } from 'mongoose';

export interface Pagination {
  limit?: number; // Number of items per page
  page?: number; // Current page (1-based index)
}

export interface SortParam {
  field?: string; // e.g., 'createdAt', 'name', 'email'
  direction?: 'ASC' | 'DESC'; // Sorting direction
}

export interface PaginationResult {
  hasNextPage: boolean; // Indicates if there's a next page
  hasPreviousPage: boolean; // Indicates if there's a previous page
  nextPage?: number; // The next page number if it exists
  previousPage?: number; // The previous page number if it exists
  totalDocs: number; // Total number of documents
  docsRetrieved: number; // Number of documents retrieved in the current page
}

export interface ListPaginationResult<T> {
  data: T[]; // List of data for the current page
  paginationResult: PaginationResult; // Pagination metadata
}

export interface ListPaginationOptions<T extends Document> {
  model: Model<T>; // Mongoose model
  baseFilter?: Record<string, any>; // Base filter to apply to the query
  additionalFilter?: Record<string, any>; // Additional filter to apply to the query
  sortParam?: SortParam; // Sorting parameter (field and direction)
  pagination?: Pagination; // Pagination options (limit and page)
}

export interface KeysetCursor {
  fieldValue: any; // e.g., Date if sorting by createdAt, string if sorting by name
  id: string; // tie-breaker (UUID or _id)
}

export interface KeysetPagination {
  limit?: number;
  after?: KeysetCursor; // Return items "older" (if DESC) or "greater" (if ASC) than this
  before?: KeysetCursor; // Return items "newer" (if DESC) or "less" (if ASC) than this
}

export interface SortParam {
  field?: string; // e.g., 'createdAt', 'name', 'email'
  direction?: 'ASC' | 'DESC';
}

export interface KeysetCursor {
  fieldValue: any;
  id: string;
}

export interface KeysetPagination {
  limit?: number;
  after?: KeysetCursor;
  before?: KeysetCursor;
}

export interface SortParam {
  field?: string;
  direction?: 'ASC' | 'DESC';
}

export interface KeysetResult {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextCursor?: KeysetCursor;
  previousCursor?: KeysetCursor;
  totalDocs: number;
  docsRetrieved: number;
}

export interface ListResult {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextCursor?: KeysetCursor;
  previousCursor?: KeysetCursor;
  totalDocs: number;
  docsRetrieved: number;
}

export interface ListKeysetResult<T> {
  data: T[];
  paginationResult: KeysetResult;
}

export interface ListKeysetOptions<T extends Document> {
  model: Model<T>;
  baseFilter?: Record<string, any>;
  additionalFilter?: Record<string, any>;
  sortParam?: SortParam;
  pagination?: KeysetPagination;
}
