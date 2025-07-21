import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Admin from '../features/admin/admin.model';
import AdminAuthService from '../services/admin-auth.service';
import { ErrorResponse } from '../utils/responses';

export interface AdminRequest extends Request {
  admin?: any;
}

/**
 * Enhanced admin authentication middleware
 */
export const authenticateAdmin = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new ErrorResponse(401, 'Access token required');
    }

    // Verify token
    const decoded: any = jwt.verify(
      token,
      process.env.JWT_SECRET_KEY as string
    );

    // Get admin details
    const admin = await Admin.findById(decoded.id);
    if (!admin || !admin.isActive) {
      throw new ErrorResponse(401, 'Invalid or inactive admin account');
    }

    // Check session timeout
    const sessionExpiry = new Date(
      admin.lastActiveAt!.getTime() + admin.sessionTimeoutMinutes * 60 * 1000
    );
    if (new Date() > sessionExpiry) {
      throw new ErrorResponse(401, 'Session expired');
    }

    // Update last active time
    await AdminAuthService.updateLastActive(admin._id);

    // Add admin to request
    req.admin = admin;
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
};

/**
 * Check admin permissions middleware
 */
export const requirePermission = (permission: string) => {
  return async (req: AdminRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.admin) {
        throw new ErrorResponse(401, 'Authentication required');
      }

      const hasPermission = await AdminAuthService.hasPermission(
        req.admin._id,
        permission
      );
      if (!hasPermission) {
        throw new ErrorResponse(403, `Permission required: ${permission}`);
      }

      next();
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ error: error.message });
    }
  };
};

/**
 * Check minimum access level middleware
 */
export const requireAccessLevel = (minLevel: number) => {
  return (req: AdminRequest, res: Response, next: NextFunction) => {
    if (!req.admin) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.admin.accessLevel < minLevel) {
      return res.status(403).json({ error: 'Insufficient access level' });
    }

    next();
  };
};

export default {
  authenticateAdmin,
  requirePermission,
  requireAccessLevel,
};
