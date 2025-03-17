import { GraphQLError, GraphQLFormattedError } from 'graphql';
import { ErrorResponse } from './responses';

export const formatError = (
  formattedError: GraphQLFormattedError,
  error: unknown
): GraphQLFormattedError => {
  console.error('GraphQL Error:', formattedError, error); // Log error details
  if (
    error instanceof GraphQLError &&
    error.originalError instanceof ErrorResponse
  ) {
    const customError = error.originalError as ErrorResponse;
    console.log('custom error');
    console.log(customError.details);
    const response = {
      ...formattedError,
      message: customError.message,
      extensions: {
        ...formattedError.extensions,
        code: customError.code,
        details: customError.details,
      },
    };
    console.log(response);

    return response;
  }

  return formattedError;
};
