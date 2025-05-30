import { combineResolvers } from 'graphql-resolvers';
import DriverController from './driver.controller';
import { protectEntities } from '../../utils/auth-middleware';

const driverResolvers = {
  Query: {
    listDrivers: combineResolvers(
      protectEntities(['ADMIN']),
      DriverController.listDrivers
    ),
    getDriver: combineResolvers(
      protectEntities(['ADMIN']),
      DriverController.getDriver
    ),
    loggedInDriver: combineResolvers(
      protectEntities(['DRIVER', 'ADMIN']),
      DriverController.loggedInDriver
    ),
  },
  Mutation: {
    registerDriver: DriverController.registerDriver,
    updateDriverPersonalInfo: combineResolvers(
      protectEntities(['DRIVER', 'ADMIN']),
      DriverController.updateDriverPersonalInfo
    ),
    updateDriverLicense: combineResolvers(
      protectEntities(['DRIVER', 'ADMIN']),
      DriverController.updateDriverLicense
    ),

    updateDriverProfilePhoto: combineResolvers(
      protectEntities(['DRIVER', 'ADMIN']),
      DriverController.updateProfilePhoto
    ),
  },
};

export default driverResolvers;
