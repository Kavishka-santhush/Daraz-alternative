import { Prisma, UserStatus, SellerStatus, SellerTier, UserRole } from '@prisma/client';
import { prisma, section, info, hashPassword, daysFromNow } from './helpers';

export interface UsersResult {
  staffIds: string[];
  seller: { userId: string; profileId: string; shopId: string };
  shops: Array<{ userId: string; profileId: string; shopId: string; slug: string }>;
  buyerIds: string[];
}

interface StaffSpec {
  email: string;
  name: string;
  role: UserRole;
}

const STAFF: StaffSpec[] = [
  { email: 'super@marketplace.local', name: 'Saman Perera', role: UserRole.SUPER_ADMIN },
  { email: 'admin@marketplace.local', name: 'Nimal Silva', role: UserRole.ADMIN },
  { email: 'ops@marketplace.local', name: 'Kamala Fonseka', role: UserRole.OPERATIONS_MANAGER },
  { email: 'support@marketplace.local', name: 'Ruwan Jayasinghe', role: UserRole.SUPPORT_AGENT },
  { email: 'finance@marketplace.local', name: 'Dilani Fernando', role: UserRole.FINANCE_MANAGER },
];

const SELLERS: Array<{
  email: string;
  name: string;
  phone: string;
  shopName: string;
  shopSlug: string;
  tier: SellerTier;
}> = [
  { email: 'seller@marketplace.local', name: 'TechHub Lanka', phone: '+94770000001', shopName: 'TechHub Official Store', shopSlug: 'techhub', tier: SellerTier.GOLD },
  { email: 'fashion@marketplace.local', name: 'StyleHouse', phone: '+94770000002', shopName: 'StyleHouse Fashion', shopSlug: 'stylehouse', tier: SellerTier.SILVER },
  { email: 'home@marketplace.local', name: 'HomeNest', phone: '+94770000003', shopName: 'HomeNest Living', shopSlug: 'homenest', tier: SellerTier.BRONZE },
];

const BUYERS: Array<{ email: string; name: string; phone: string }> = [
  { email: 'buyer@marketplace.local', name: 'Alex Ranasinghe', phone: '+94771111111' },
  { email: 'ana@marketplace.local', name: 'Ana Fernando', phone: '+94771111112' },
  { email: 'bob@marketplace.local', name: 'Bob Silva', phone: '+94771111113' },
];

/**
 * Staff accounts, demo sellers (+profiles+shops), buyers (+wallets+addresses).
 */
export async function seedUsers(): Promise<UsersResult> {
  section('Users: staff / sellers / buyers');
  const passwordHash = await hashPassword();
  const staffIds: string[] = [];

  for (const s of STAFF) {
    const u = await prisma.user.upsert({
      where: { email: s.email },
      update: { name: s.name, role: s.role, status: UserStatus.ACTIVE },
      create: {
        email: s.email,
        name: s.name,
        passwordHash,
        role: s.role,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: daysFromNow(-30),
      },
    });
    staffIds.push(u.id);
  }
  info(`${staffIds.length} staff accounts`);

  // Sellers + profiles + shops.
  let primary: UsersResult['seller'] | null = null;
  const shops: UsersResult['shops'] = [];
  for (const spec of SELLERS) {
    const user = await prisma.user.upsert({
      where: { email: spec.email },
      update: { name: spec.name, role: UserRole.SELLER, status: UserStatus.ACTIVE },
      create: {
        email: spec.email,
        name: spec.name,
        phone: spec.phone,
        passwordHash,
        role: UserRole.SELLER,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: daysFromNow(-20),
        phoneVerifiedAt: daysFromNow(-20),
      },
    });

    const approvedBy = staffIds[0] ?? null;
    const profile = await prisma.sellerProfile.upsert({
      where: { userId: user.id },
      update: { status: SellerStatus.APPROVED, tier: spec.tier, isVerified: true },
      create: {
        userId: user.id,
        status: SellerStatus.APPROVED,
        tier: spec.tier,
        isVerified: true,
        approvedAt: daysFromNow(-15),
        approvedById: approvedBy,
        payoutBank: { bank: 'Commercial Bank', accountNo: '8012345678', holder: spec.name } as unknown as Prisma.InputJsonValue,
      },
    });

    const shop = await prisma.shop.upsert({
      where: { slug: spec.shopSlug },
      update: { name: spec.shopName, sellerId: profile.id },
      create: {
        sellerId: profile.id,
        name: spec.shopName,
        slug: spec.shopSlug,
        description: `${spec.shopName} — verified marketplace seller.`,
        isActive: true,
        defaultDeliveryDays: 4,
      },
    });

    await ensureWallet(user.id, 0);
    const entry = { userId: user.id, profileId: profile.id, shopId: shop.id, slug: spec.shopSlug };
    shops.push(entry);
    if (!primary) primary = { userId: user.id, profileId: profile.id, shopId: shop.id };
  }
  info(`${SELLERS.length} sellers + shops`);

  // Buyers + wallets + a default address.
  const buyerIds: string[] = [];
  for (const b of BUYERS) {
    const user = await prisma.user.upsert({
      where: { email: b.email },
      update: { name: b.name, role: UserRole.BUYER, status: UserStatus.ACTIVE },
      create: {
        email: b.email,
        name: b.name,
        phone: b.phone,
        passwordHash,
        role: UserRole.BUYER,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: daysFromNow(-10),
        phoneVerifiedAt: daysFromNow(-10),
      },
    });
    buyerIds.push(user.id);
    await ensureWallet(user.id, 5000);
    await ensureDefaultAddress(user, b);
  }
  info(`${buyerIds.length} buyers + wallets + addresses`);

  if (!primary) throw new Error('seller seeding failed: no primary seller');
  return { staffIds, seller: primary, shops, buyerIds };
}

async function ensureWallet(userId: string, balance: number) {
  const existing = await prisma.wallet.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.wallet.create({
    data: { userId, balance: new Prisma.Decimal(balance), currency: 'LKR' },
  });
}

async function ensureDefaultAddress(
  user: { id: string },
  b: { name: string; phone: string },
) {
  const exists = await prisma.address.findFirst({ where: { userId: user.id } });
  if (exists) return exists;
  return prisma.address.create({
    data: {
      userId: user.id,
      label: 'Home',
      contactName: b.name,
      contactPhone: b.phone,
      line1: '42 Galle Road',
      city: 'Colombo',
      province: 'Western',
      postalCode: '00300',
      isDefault: true,
    },
  });
}
