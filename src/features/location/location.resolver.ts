import { combineResolvers } from 'graphql-resolvers';
import LocationController from './location.controller';

const locationResolvers = {
  Query: {
    listLocations: LocationController.listLocations,
    getLocation: LocationController.getLocation,
  },
  Mutation: {
    createLocation: combineResolvers(
      // protectAdmin,
      LocationController.createLocation
    ),
    updateLocation: combineResolvers(
      // protectAdmin,
      LocationController.updateLocation
    ),
    deleteLocation: combineResolvers(
      // protectAdmin,
      LocationController.deleteLocation
    ),
  },
};

export default locationResolvers;
