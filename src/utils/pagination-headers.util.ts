import { Response } from 'express';
import { KeysetResult } from '../types/list-resources';

/**
 * Sets relevant pagination headers on the Express response.
 */
export function setPaginationHeaders<T>(
  res: Response,
  pagination: KeysetResult
): void {
  const {
    hasNextPage,
    hasPreviousPage,
    nextCursor,
    previousCursor,
    totalDocs,
    docsRetrieved,
  } = pagination;

  // Basic counts
  res.set('X-Total-Docs', String(totalDocs));
  res.set('X-Docs-Retrieved', String(docsRetrieved));

  // Next/previous page flags
  res.set('X-Has-Next-Page', hasNextPage ? 'true' : 'false');
  res.set('X-Has-Previous-Page', hasPreviousPage ? 'true' : 'false');

  // Next cursor
  if (nextCursor) {
    res.set('X-Next-Cursor-FieldValue', String(nextCursor.fieldValue));
    res.set('X-Next-Cursor-Id', String(nextCursor.id));
  } else {
    // Optionally set them to empty or remove them
    res.set('X-Next-Cursor-FieldValue', '');
    res.set('X-Next-Cursor-Id', '');
  }

  // Previous cursor
  if (previousCursor) {
    res.set('X-Previous-Cursor-FieldValue', String(previousCursor.fieldValue));
    res.set('X-Previous-Cursor-Id', String(previousCursor.id));
  } else {
    res.set('X-Previous-Cursor-FieldValue', '');
    res.set('X-Previous-Cursor-Id', '');
  }
}

export function setPagePaginationHeaders(
  res: Response,
  pagination: {
    totalDocs: number;
    docsRetrieved: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextPage?: number;
    previousPage?: number;
  }
): void {
  const {
    totalDocs,
    docsRetrieved,
    hasNextPage,
    hasPreviousPage,
    nextPage,
    previousPage,
  } = pagination;

  // Basic counts
  res.set('X-Total-Docs', String(totalDocs));
  res.set('X-Docs-Retrieved', String(docsRetrieved));

  // Next/previous page flags
  res.set('X-Has-Next-Page', hasNextPage ? 'true' : 'false');
  res.set('X-Has-Previous-Page', hasPreviousPage ? 'true' : 'false');

  // Next and previous page numbers
  res.set('X-Next-Page', nextPage !== undefined ? String(nextPage) : '');
  res.set(
    'X-Previous-Page',
    previousPage !== undefined ? String(previousPage) : ''
  );
}
