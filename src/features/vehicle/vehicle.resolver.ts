import { combineResolvers } from 'graphql-resolvers';
import VehicleController from './vehicle.controller';
import { protectEntities } from '../../utils/auth-middleware';

const vehicleResolvers = {
  Query: {
    listVehicles: VehicleController.listVehicles,
    getVehicle: VehicleController.getVehicle,
  },
  Mutation: {
    createVehicle: combineResolvers(
      protectEntities(['ADMIN', 'DRIVER']),
      VehicleController.createVehicle
    ),
    updateVehicle: combineResolvers(
      protectEntities(['ADMIN', 'DRIVER']),
      VehicleController.updateVehicle
    ),
    deleteVehicle: combineResolvers(
      protectEntities(['ADMIN', 'DRIVER']),
      VehicleController.deleteVehicle
    ),
  },
};

export default vehicleResolvers;
