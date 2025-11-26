// list-resources-keyset.ts

import { Document } from 'mongoose';
import {
  KeysetCursor,
  KeysetResult,
  ListKeysetOptions,
  ListKeysetResult,
} from '../types/list-resources';

export async function listResourcesKeyset<T extends Document>(
  options: ListKeysetOptions<T>
): Promise<ListKeysetResult<T>> {
  const {
    model,
    baseFilter = {},
    additionalFilter = {},
    sortParam,
    pagination = {},
  } = options;
  const filter: any = { ...baseFilter, ...additionalFilter };

  // Count total documents ignoring after/before, but including the combined filters
  const totalDocs = await model.countDocuments(filter);

  const field = sortParam?.field || 'createdAt';
  const direction = sortParam?.direction === 'ASC' ? 1 : -1;

  // Tie-break by 'id' in the same direction
  const sortObject: Record<string, 1 | -1> = {
    [field]: direction,
    id: direction,
  };

  let finalFilter: Record<string, any> = { ...filter };

  if (pagination.after) {
    const cursorCondition = buildCursorCondition(
      field,
      direction,
      pagination.after,
      true
    );
    finalFilter = { ...finalFilter, $or: cursorCondition };
  }

  if (pagination.before) {
    const cursorCondition = buildCursorCondition(
      field,
      direction,
      pagination.before,
      false
    );
    finalFilter = { ...finalFilter, $or: cursorCondition };
  }

  const limit = pagination.limit ?? 10;

  // Fetch limit + 1 to detect hasNextPage
  const docs = await model
    .find(finalFilter)
    .sort(sortObject)
    .limit(limit + 1);

  console.log(sortObject);

  const hasMore = docs.length > limit;
  const data = docs.slice(0, limit);
  const docsRetrieved = data.length;

  let hasNextPage = false;
  let nextCursor: KeysetCursor | undefined;

  if (hasMore) {
    hasNextPage = true;
    const lastDoc = data[data.length - 1];
    nextCursor = {
      fieldValue: (lastDoc as any)[field],
      id: (lastDoc as any).id,
    };
  } else if (data.length > 0) {
    const lastDoc = data[data.length - 1];
    const condition = buildCursorCondition(
      field,
      direction,
      {
        fieldValue: (lastDoc as any)[field],
        id: (lastDoc as any).id,
      },
      true
    );
    const countBeyond = await model.countDocuments({
      ...filter,
      $or: condition,
    });
    if (countBeyond > 0) {
      hasNextPage = true;
      nextCursor = {
        fieldValue: (lastDoc as any)[field],
        id: (lastDoc as any).id,
      };
    }
  }

  let hasPreviousPage = false;
  let previousCursor: KeysetCursor | undefined;

  if (data.length > 0) {
    const firstDoc = data[0];
    const condition = buildCursorCondition(
      field,
      direction,
      {
        fieldValue: (firstDoc as any)[field],
        id: (firstDoc as any).id,
      },
      false
    );
    const countOpposite = await model.countDocuments({
      ...filter,
      $or: condition,
    });
    if (countOpposite > 0) {
      hasPreviousPage = true;
      previousCursor = {
        fieldValue: (firstDoc as any)[field],
        id: (firstDoc as any).id,
      };
    }
  }

  if (nextCursor && nextCursor.fieldValue instanceof Date) {
    nextCursor.fieldValue = nextCursor.fieldValue.toISOString();
  }

  if (previousCursor && previousCursor.fieldValue instanceof Date) {
    previousCursor.fieldValue = previousCursor.fieldValue.toISOString();
  }

  return {
    data: data,
    paginationResult: {
      totalDocs, // all docs matching the filter, ignoring cursors
      docsRetrieved, // how many docs are in this "page"
      hasNextPage,
      hasPreviousPage,
      nextCursor,
      previousCursor,
    },
  };
}

function buildCursorCondition(
  field: string,
  direction: number,
  cursor: KeysetCursor,
  isAfter: boolean
): Record<string, any>[] {
  let primaryOp = '$lt';
  let tieOp = '$lt';

  // DESC logic
  if (direction === -1) {
    if (isAfter) {
      primaryOp = '$lt';
      tieOp = '$lt';
    } else {
      primaryOp = '$gt';
      tieOp = '$gt';
    }
  }

  // ASC logic
  if (direction === 1) {
    if (isAfter) {
      primaryOp = '$gt';
      tieOp = '$gt';
    } else {
      primaryOp = '$lt';
      tieOp = '$lt';
    }
  }

  return [
    { [field]: { [primaryOp]: cursor.fieldValue } },
    {
      [field]: cursor.fieldValue,
      id: { [tieOp]: cursor.id },
    },
  ];
}
