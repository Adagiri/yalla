import { ErrorResponse } from './responses';

export const handleAsync = <T extends (...args: any[]) => Promise<any>>(
  fn: T
) => {
  return async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof ErrorResponse) {
        throw error; // Custom application errors
      } else {
        console.error('Unexpected Error:', error);
        throw new ErrorResponse(500, 'Internal server error');
      }
    }
  };
};
