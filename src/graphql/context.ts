import Driver from '../features/driver/driver.model';
import Customer from '../features/customer/customer.model';
import Admin from '../features/admin/admin.model';
import { getUserInfo } from '../utils/auth-middleware';
import { ExpressContextFunctionArgument } from '@apollo/server/express4';

export const context = async ({ req, res }: ExpressContextFunctionArgument) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = token ? getUserInfo(token) : null;
  return {
    req,
    res,
    user,
    models: {
      Driver,
      Customer,
      Admin,
    },
  };
};
