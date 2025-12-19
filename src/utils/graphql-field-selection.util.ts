import { GraphQLResolveInfo, FieldNode, SelectionSetNode } from 'graphql';

/**
 * Extract requested field names from GraphQL info
 */
export function getRequestedFields(info: GraphQLResolveInfo): string[] {
  const fieldNode = info.fieldNodes[0];
  if (!fieldNode.selectionSet) return [];

  return extractFields(fieldNode.selectionSet);
}

function extractFields(selectionSet: SelectionSetNode): string[] {
  const fields: string[] = [];

  for (const selection of selectionSet.selections) {
    if (selection.kind === 'Field') {
      const fieldName = selection.name.value;

      // Skip __typename
      if (fieldName === '__typename') continue;

      // Handle nested fields (e.g., pickup.address)
      if (selection.selectionSet) {
        const nestedFields = extractFields(selection.selectionSet);
        nestedFields.forEach((nested) => {
          fields.push(`${fieldName}.${nested}`);
        });
      } else {
        fields.push(fieldName);
      }
    }
  }

  return fields;
}

/**
 * Convert GraphQL fields to Mongoose select string
 */
export function toMongooseSelect(fields: string[]): string {
  return fields.join(' ');
}
