import { combineResolvers } from 'graphql-resolvers';
import LocationController from './location.controller';
import { protectEntities } from '../../utils/auth-middleware';

const locationResolvers = {
  Query: {
    listLocations: LocationController.listLocations,
    getLocation: LocationController.getLocation,
    findNearbyLocations: LocationController.findNearbyLocations,
    findLocationsByPoint: LocationController.findLocationsByPoint,
  },
  Mutation: {
    createLocation: combineResolvers(
      protectEntities(['ADMIN']),
      LocationController.createLocation
    ),
    updateLocation: combineResolvers(
      protectEntities(['ADMIN']),
      LocationController.updateLocation
    ),
    deleteLocation: combineResolvers(
      protectEntities(['ADMIN']),
      LocationController.deleteLocation
    ),
    toggleLocationStatus: combineResolvers(
      protectEntities(['ADMIN']),
      LocationController.toggleLocationStatus
    ),
  },
};

export default locationResolvers;
