export interface Pagination {
  page: number;
  limit: number;
}

export interface PaginationHeaders {
  totalDocs: number;
  docsRetrieved: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextPage?: number;
  previousPage?: number;
}

export function setPagePaginationHeaders(
  res: any,
  headers: PaginationHeaders
): void {
  if (res && res.set) {
    res.set('X-Total-Docs', headers.totalDocs.toString());
    res.set('X-Docs-Retrieved', headers.docsRetrieved.toString());
    res.set('X-Has-Next-Page', headers.hasNextPage.toString());
    res.set('X-Has-Previous-Page', headers.hasPreviousPage.toString());

    if (headers.nextPage) {
      res.set('X-Next-Page', headers.nextPage.toString());
    }

    if (headers.previousPage) {
      res.set('X-Previous-Page', headers.previousPage.toString());
    }
  }
}
