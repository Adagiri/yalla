import DataLoader from 'dataloader';
import Trip from '../features/trip/trip.model';

export interface TripLoaderKey {
  id: string;
  fields: string;
}

export function createTripLoader() {
  return new DataLoader<TripLoaderKey, any, string>(
    async (keys) => {
      // Group by fields to batch efficiently
      const fieldGroups = new Map<string, string[]>();

      keys.forEach((key) => {
        const existing = fieldGroups.get(key.fields) || [];
        existing.push(key.id);
        fieldGroups.set(key.fields, existing);
      });

      // Fetch each group with its specific fields
      const results = new Map<string, any>();

      for (const [fields, ids] of fieldGroups) {
        let query = Trip.find({ _id: { $in: ids } });

        if (fields) {
          query = query.select(fields);
        }

        const trips = await query.lean();

        trips.forEach((trip) => {
          results.set(trip._id.toString(), {
            ...trip,
            id: trip._id.toString(),
          });
        });
      }

      console.log(keys.map((key) => results.get(key.id) || null));

      return keys.map((key) => results.get(key.id) || null);
    },
    {
      cacheKeyFn: (key: TripLoaderKey): string => `${key.id}:${key.fields}`,
    }
  );
}
