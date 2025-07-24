export const ADMIN_PERMISSIONS = {
  // Dashboard & Analytics
  DASHBOARD_VIEW: 'dashboard:view',
  ANALYTICS_VIEW: 'analytics:view',
  REPORTS_GENERATE: 'reports:generate',

  // Driver Management
  DRIVERS_VIEW: 'drivers:view',
  DRIVERS_CREATE: 'drivers:create',
  DRIVERS_UPDATE: 'drivers:update',
  DRIVERS_DELETE: 'drivers:delete',
  DRIVERS_SUSPEND: 'drivers:suspend',
  DRIVERS_VERIFY: 'drivers:verify',

  // Customer Management
  CUSTOMERS_VIEW: 'customers:view',
  CUSTOMERS_UPDATE: 'customers:update',
  CUSTOMERS_SUSPEND: 'customers:suspend',

  // Trip Management
  TRIPS_VIEW: 'trips:view',
  TRIPS_ASSIGN: 'trips:assign',
  TRIPS_CANCEL: 'trips:cancel',
  TRIPS_REFUND: 'trips:refund',

  // Financial Management
  FINANCE_VIEW: 'finance:view',
  FINANCE_PROCESS: 'finance:process',
  FINANCE_REFUND: 'finance:refund',
  WALLET_MANAGE: 'wallet:manage',
  PAYOUTS_PROCESS: 'payouts:process',

  // System Management
  SYSTEM_CONFIG: 'system:config',
  USERS_ADMIN: 'users:admin',
  PERMISSIONS_MANAGE: 'permissions:manage',
  AUDIT_LOGS: 'audit:logs',

  // Communication
  NOTIFICATIONS_SEND: 'notifications:send',
  TEMPLATES_MANAGE: 'templates:manage',
  BROADCASTS_SEND: 'broadcasts:send',
} as const;

export const ROLE_PERMISSIONS = {
  SUPER_ADMIN: Object.values(ADMIN_PERMISSIONS),
  ADMIN: [
    ADMIN_PERMISSIONS.DASHBOARD_VIEW,
    ADMIN_PERMISSIONS.ANALYTICS_VIEW,
    ADMIN_PERMISSIONS.DRIVERS_VIEW,
    ADMIN_PERMISSIONS.DRIVERS_UPDATE,
    ADMIN_PERMISSIONS.CUSTOMERS_VIEW,
    ADMIN_PERMISSIONS.TRIPS_VIEW,
    ADMIN_PERMISSIONS.FINANCE_VIEW,
    ADMIN_PERMISSIONS.NOTIFICATIONS_SEND,
  ],
  MANAGER: [
    ADMIN_PERMISSIONS.DASHBOARD_VIEW,
    ADMIN_PERMISSIONS.DRIVERS_VIEW,
    ADMIN_PERMISSIONS.CUSTOMERS_VIEW,
    ADMIN_PERMISSIONS.TRIPS_VIEW,
  ],
  SUPPORT: [
    ADMIN_PERMISSIONS.CUSTOMERS_VIEW,
    ADMIN_PERMISSIONS.TRIPS_VIEW,
    ADMIN_PERMISSIONS.NOTIFICATIONS_SEND,
  ],
  ANALYST: [
    ADMIN_PERMISSIONS.DASHBOARD_VIEW,
    ADMIN_PERMISSIONS.ANALYTICS_VIEW,
    ADMIN_PERMISSIONS.REPORTS_GENERATE,
  ],
} as const;
