import { Document } from 'mongoose';
import {
  ListPaginationOptions,
  ListPaginationResult,
} from '../types/list-resources';

export async function listResourcesPagination<T extends Document>(
  options: ListPaginationOptions<T>
): Promise<ListPaginationResult<T>> {
  const {
    model,
    baseFilter = {},
    additionalFilter = {},
    sortParam,
    pagination = {},
  } = options;

  const filter: any = { ...baseFilter };

  if (additionalFilter) {
    Object.entries(additionalFilter).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        if (key === 'ids') {
          filter['id'] = { $in: value };
        } else {
          filter[key] = { $in: value };
        }
      } else if (typeof value === 'string') {
        filter[key] = { $regex: value, $options: 'i' };
      } else {
        filter[key] = value;
      }
    });
  }

  const totalDocs = await model.countDocuments(filter);

  const field = sortParam?.field || 'createdAt';
  const direction = sortParam?.direction === 'ASC' ? 1 : -1;

  const sortObject: Record<string, 1 | -1> = {
    [field]: direction,
    id: direction,
  };

  const limit = pagination.limit ?? 10;
  const page = pagination.page ?? 1;

  const skip = (page - 1) * limit;

  const docs = await model
    .find(filter)
    .sort(sortObject)
    .skip(skip)
    .limit(limit);

  const docsRetrieved = docs.length;

  const hasNextPage = docsRetrieved === limit && totalDocs > page * limit;
  const hasPreviousPage = page > 1;

  return {
    data: docs,
    paginationResult: {
      totalDocs,
      docsRetrieved,
      hasNextPage,
      hasPreviousPage,
      nextPage: hasNextPage ? page + 1 : undefined,
      previousPage: hasPreviousPage ? page - 1 : undefined,
    },
  };
}
