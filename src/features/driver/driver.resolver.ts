import { combineResolvers } from 'graphql-resolvers';
import DriverController from './driver.controller';
import { protectEntities } from '../../utils/auth-middleware';
import { withFilter } from 'graphql-subscriptions';
import { pubsub } from '../../graphql/pubsub';
import { SUBSCRIPTION_EVENTS } from '../../graphql/subscription-events';

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

  Subscription: {
    // Driver status changes (online/offline/busy)
    driverStatusChanged: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.DRIVER_STATUS_CHANGED),
        (payload, variables, context) => {
          const statusUpdate = payload.driverStatusChanged;

          // Allow driver to subscribe to their own status OR admins to monitor all drivers
          const user = context.user;
          const isOwnStatus = statusUpdate.driverId === variables.driverId;
          const isAdmin = user && ['SUPER_ADMIN', 'admin'].includes(user.role);

          return isOwnStatus || isAdmin;
        }
      ),
    },

    // Driver earnings updates
    driverEarningsUpdate: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.DRIVER_EARNINGS_UPDATE),
        (payload, variables, context) => {
          const earningsUpdate = payload.driverEarningsUpdate;
          const user = context.user;

          // Only the driver themselves can see their earnings
          return earningsUpdate.driverId === user?.id;
        }
      ),
    },
  },
};

export default driverResolvers;
