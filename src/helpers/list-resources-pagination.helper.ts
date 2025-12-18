import { Document } from 'mongoose';
import {
  ListPaginationOptions,
  ListPaginationResult,
} from '../types/list-resources';

// export async function listResourcesPagination<T extends Document>(
//   options: ListPaginationOptions<T>
// ): Promise<ListPaginationResult<T>> {
//   const {
//     model,
//     baseFilter = {},
//     additionalFilter = {},
//     sortParam,
//     pagination = {},
//     populate,
//   } = options;

//   const filter: any = { ...baseFilter };

//   if (additionalFilter) {
//     // Handle search field for full-text search
//     if (additionalFilter.search) {
//       filter.$or = [
//         { name: { $regex: additionalFilter.search, $options: 'i' } },
//         { address: { $regex: additionalFilter.search, $options: 'i' } },
//         { description: { $regex: additionalFilter.search, $options: 'i' } },
//         { email: { $regex: additionalFilter.search, $options: 'i' } },
//         { firstname: { $regex: additionalFilter.search, $options: 'i' } },
//         { lastname: { $regex: additionalFilter.search, $options: 'i' } },
//         {
//           phone: {
//             fullphone: { $regex: additionalFilter.search, $options: 'i' },
//           },
//         },
//         { modelName: { $regex: additionalFilter.search, $options: 'i' } },
//         { manufactureYear: { $regex: additionalFilter.search, $options: 'i' } },
//         {
//           identificationNumber: {
//             $regex: additionalFilter.search,
//             $options: 'i',
//           },
//         },
//       ];
//       // Remove search to avoid processing it as a  field
//       delete additionalFilter.search;
//     }

//     // Handle other filters
//     Object.entries(additionalFilter).forEach(([key, value]) => {
//       if (Array.isArray(value)) {
//         if (key === 'ids') {
//           filter['id'] = { $in: value };
//         } else {
//           filter[key] = { $in: value };
//         }
//       } else if (typeof value === 'string') {
//         filter[key] = { $regex: value, $options: 'i' };
//       } else {
//         filter[key] = value;
//       }
//     });
//   }

//   const totalDocs = await model.countDocuments(filter);
//   const field = sortParam?.field || 'createdAt';
//   const direction = sortParam?.direction === 'ASC' ? 1 : -1;

//   const sortObject: Record<string, 1 | -1> = {
//     [field]: direction,
//     id: direction,
//   };

//   const limit = pagination.limit ?? 10;
//   const page = pagination.page ?? 1;

//   const skip = (page - 1) * limit;

//   let query = model.find(filter).sort(sortObject).skip(skip).limit(limit);

//   if (populate) {
//     query = query.populate(populate);
//   }

//   const docs = await query;
//   const docsRetrieved = docs.length;

//   const hasNextPage = docsRetrieved === limit && totalDocs > page * limit;
//   const hasPreviousPage = page > 1;

//   return {
//     data: docs,
//     paginationResult: {
//       totalDocs,
//       docsRetrieved,
//       hasNextPage,
//       hasPreviousPage,
//       nextPage: hasNextPage ? page + 1 : undefined,
//       previousPage: hasPreviousPage ? page - 1 : undefined,
//     },
//   };
// }
export async function listResourcesPagination<T extends Document>(
  options: ListPaginationOptions<T>
): Promise<ListPaginationResult<T>> {
  const {
    model,
    baseFilter = {},
    additionalFilter = {},
    sortParam,
    pagination = {},
    populate,
  } = options;

  const filter: any = { ...baseFilter };

  if (additionalFilter) {
    // Handle search field for full-text search
    if (additionalFilter.search) {
      // Escape special regex characters to prevent regex injection and errors
      const searchValue = additionalFilter.search;
      const escapedSearch = escapeRegex(searchValue);
      const normalizedPhone = searchValue.replace(/^0+/, ''); // Remove leading zeros
      const escapedNormalizedPhone = escapeRegex(normalizedPhone);
      const searchConditions = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { address: { $regex: escapedSearch, $options: 'i' } },
        { description: { $regex: escapedSearch, $options: 'i' } },
        { email: { $regex: escapedSearch, $options: 'i' } },
        { firstname: { $regex: escapedSearch, $options: 'i' } },
        { lastname: { $regex: escapedSearch, $options: 'i' } },
        { 'phone.fullPhone': { $regex: escapedSearch, $options: 'i' } },
        {
          'phone.localNumber': {
            $regex: escapedNormalizedPhone,
            $options: 'i',
          },
        },
        { modelName: { $regex: escapedSearch, $options: 'i' } },
        { manufactureYear: { $regex: escapedSearch, $options: 'i' } },
        {
          identificationNumber: {
            $regex: escapedSearch,
            $options: 'i',
          },
        },
      ];

      // If baseFilter has $or, combine with $and to preserve both conditions
      if (filter.$or) {
        // MongoDB syntax: documents must match baseFilter $or AND search $or
        filter.$and = [
          { $or: filter.$or }, // Keep the original baseFilter $or
          { $or: searchConditions }, // Add the search $or
        ];
        delete filter.$or; // Remove the original $or since we're using $and now
      } else {
        // No conflict, just add the search $or directly
        filter.$or = searchConditions;
      }

      // Remove search to avoid processing it as a field
      delete additionalFilter.search;
    }

    // Handle other filters
    Object.entries(additionalFilter).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        if (key === 'ids') {
          filter['id'] = { $in: value };
        } else {
          filter[key] = { $in: value };
        }
      } else if (typeof value === 'string') {
        // Escape special regex characters for other string filters too
        const escapedValue = escapeRegex(value);
        filter[key] = { $regex: escapedValue, $options: 'i' };
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

  let query = model.find(filter).sort(sortObject).skip(skip).limit(limit);

  if (populate) {
    query = query.populate(populate);
  }

  const docs = await query;
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

/**
 * Escapes special regex characters to prevent regex injection
 * and syntax errors in MongoDB regex queries
 *
 * @param text - The text to escape
 * @returns Escaped text safe for use in regex patterns
 */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
