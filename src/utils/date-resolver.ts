export const createDateResolver = (fieldName: string) => {
  return (parent: any) => {
    const value = parent[fieldName];
    return value && typeof value === 'string' ? new Date(value) : value;
  };
};
