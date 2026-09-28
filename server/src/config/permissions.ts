import { UserRole } from '@prisma/client';

/**
 * Central RBAC definition. Every staff role maps to a set of permission keys.
 * Route guards check permissions, not raw roles, so future roles are additive.
 */
export const PERMISSIONS = {
  // sellers
  'seller:approve': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'seller:manage': [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OPERATIONS_MANAGER],
  'seller:payout': [UserRole.FINANCE_MANAGER, UserRole.SUPER_ADMIN],
  // products
  'product:moderate': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  // taxonomy
  'category:manage': [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  'brand:manage': [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  // orders
  'order:manage': [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OPERATIONS_MANAGER],
  // returns & disputes
  'dispute:manage': [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPPORT_AGENT],
  // payments & finance
  'payment:manage': [UserRole.FINANCE_MANAGER, UserRole.SUPER_ADMIN],
  'finance:report': [UserRole.FINANCE_MANAGER, UserRole.SUPER_ADMIN],
  // promotions
  'promo:manage': [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  'banner:manage': [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  'commission:manage': [UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER],
  // support
  'ticket:manage': [UserRole.SUPPORT_AGENT, UserRole.ADMIN, UserRole.SUPER_ADMIN],
  // users
  'user:manage': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  // platform
  'settings:manage': [UserRole.SUPER_ADMIN],
  'audit:view': [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  'fraud:review': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  if (role === UserRole.SUPER_ADMIN) return true; // super admin has every permission
  const allowed = PERMISSIONS[permission] as readonly UserRole[] | undefined;
  return allowed ? allowed.includes(role) : false;
}

export const STAFF_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.OPERATIONS_MANAGER,
  UserRole.SUPPORT_AGENT,
  UserRole.FINANCE_MANAGER,
];

export function isStaff(role: UserRole): boolean {
  return STAFF_ROLES.includes(role);
}
