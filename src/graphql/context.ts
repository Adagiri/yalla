import Driver from '../features/driver/driver.model';
import { getUserInfo } from '../utils/auth-middleware';
import { ExpressContextFunctionArgument } from '@apollo/server/dist/esm/express4';

export const context = async ({ req, res }: ExpressContextFunctionArgument) => {
  const token = req.headers.authorization?.split(' ')[1];
  const driver = token ? getUserInfo(token) : null;

  return {
    req,
    res,
    driver,
    models: {
      Driver,
    },
  };
};
