import { Prisma, VoucherScope, VoucherType, VoucherStatus } from '@prisma/client';
import { prisma, section, info, daysFromNow } from './helpers';
import type { CatalogResult } from './catalog.seed';
import type { ProductsResult } from './products.seed';
import type { UsersResult } from './users.seed';

/**
 * Marketing content: platform + seller vouchers, an active flash sale,
 * homepage banners and a bundle deal.
 */
export async function seedPromos(
  catalog: CatalogResult,
  products: ProductsResult,
  users: UsersResult,
) {
  section('Promotions: vouchers / flash sale / banners / bundles');

  // ── Vouchers ──
  const platformVoucher = await prisma.voucher.upsert({
    where: { code: 'WELCOME10' },
    update: {},
    create: {
      code: 'WELCOME10',
      name: 'Welcome 10% Off',
      description: '10% off your first order, capped at Rs 2,000.',
      scope: VoucherScope.PLATFORM,
      type: VoucherType.PERCENT,
      percentOff: new Prisma.Decimal(10),
      maxDiscount: new Prisma.Decimal(2000),
      minOrderAmount: new Prisma.Decimal(3000),
      newBuyersOnly: true,
      oneTimePerUser: true,
      usageLimit: 100000,
      status: VoucherStatus.ACTIVE,
      startsAt: daysFromNow(-1),
      expiresAt: daysFromNow(120),
      applicableCategories: { connect: [catalog.categories['electronics'], catalog.categories['fashion']].filter(Boolean).map((id) => ({ id })) },
    },
  });
  info(`voucher ${platformVoucher.code}`);

  const flatVoucher = await prisma.voucher.upsert({
    where: { code: 'FLAT500' },
    update: {},
    create: {
      code: 'FLAT500',
      name: 'Rs 500 Off',
      scope: VoucherScope.PLATFORM,
      type: VoucherType.FIXED,
      fixedOff: new Prisma.Decimal(500),
      minOrderAmount: new Prisma.Decimal(5000),
      oneTimePerUser: true,
      status: VoucherStatus.ACTIVE,
      startsAt: daysFromNow(-1),
      expiresAt: daysFromNow(60),
    },
  });
  info(`voucher ${flatVoucher.code}`);

  const shipVoucher = await prisma.voucher.upsert({
    where: { code: 'FREESHIP' },
    update: {},
    create: {
      code: 'FREESHIP',
      name: 'Free Shipping',
      scope: VoucherScope.PLATFORM,
      type: VoucherType.FREE_SHIPPING,
      minOrderAmount: new Prisma.Decimal(2500),
      status: VoucherStatus.ACTIVE,
      startsAt: daysFromNow(-1),
      expiresAt: daysFromNow(90),
    },
  });
  info(`voucher ${shipVoucher.code}`);

  // A seller-scoped voucher owned by the primary seller.
  const sellerVoucher = await prisma.voucher.upsert({
    where: { code: 'TECHHUB5' },
    update: {},
    create: {
      code: 'TECHHUB5',
      name: 'TechHub 5% Off',
      scope: VoucherScope.SELLER,
      type: VoucherType.PERCENT,
      ownerId: users.seller.profileId,
      percentOff: new Prisma.Decimal(5),
      status: VoucherStatus.ACTIVE,
      startsAt: daysFromNow(-1),
      expiresAt: daysFromNow(45),
    },
  });
  info(`seller voucher ${sellerVoucher.code}`);

  // ── Flash sale ──
  const flash = await prisma.flashSale.upsert({
    where: { slug: 'mega-weekend-sale' },
    update: { startsAt: daysFromNow(-1), endsAt: daysFromNow(2), isActive: true, status: 'LIVE' },
    create: {
      title: 'Mega Weekend Sale',
      slug: 'mega-weekend-sale',
      description: 'Limited-time deals on top brands. While stocks last!',
      startsAt: daysFromNow(-1),
      endsAt: daysFromNow(2),
      isActive: true,
      status: 'LIVE',
    },
  });

  const flashTargets = ['galaxy-s24-ultra-256gb', 'sony-wh-1000xm5-headphones', 'vitamin-c-serum-30ml', 'running-shoes-airflow'];
  let added = 0;
  for (const slug of flashTargets) {
    const productId = products.bySlug[slug];
    if (!productId) continue;
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) continue;
    const salePrice = new Prisma.Decimal(Number(product.salePrice ?? product.originalPrice) * 0.9).toDecimalPlaces(2);
    await prisma.flashSaleItem.upsert({
      where: { flashSaleId_productId: { flashSaleId: flash.id, productId } },
      update: { salePrice },
      create: { flashSaleId: flash.id, productId, salePrice, stockLimit: 20, soldCount: 0 },
    });
    added++;
  }
  info(`flash sale "${flash.title}" with ${added} items`);

  // ── Banners ──
  const banners: Array<{ title: string; placement: string; targetUrl: string }> = [
    { title: 'Electronics Mega Sale', placement: 'HOME_HERO', targetUrl: '/category/electronics' },
    { title: 'Fashion Week', placement: 'HOME_HERO', targetUrl: '/category/fashion' },
    { title: 'Fresh Groceries Daily', placement: 'HOME_STRIP', targetUrl: '/category/groceries' },
    { title: 'Beauty Bonanza', placement: 'CATEGORY_SIDEBAR', targetUrl: '/category/beauty-health' },
  ];
  for (let i = 0; i < banners.length; i++) {
    const b = banners[i];
    const exists = await prisma.banner.findFirst({ where: { title: b.title, placement: b.placement } });
    if (exists) continue;
    await prisma.banner.create({
      data: {
        title: b.title,
        placement: b.placement,
        imageUrl: `/uploads/demo/banner-${i + 1}.jpg`,
        mobileImageUrl: `/uploads/demo/banner-${i + 1}-m.jpg`,
        targetUrl: b.targetUrl,
        altText: b.title,
        sortOrder: i,
        isActive: true,
      },
    });
  }
  info(`${banners.length} banners`);

  // ── Bundle deal ──
  const cookwareId = products.bySlug['ceramic-cookware-set'];
  const riceId = products.bySlug['basmati-rice-5kg'];
  const homeShop = users.shops.find((s) => s.slug === 'homenest');
  if (cookwareId && riceId && homeShop) {
    const existingBundle = await prisma.bundleDeal.findFirst({ where: { title: 'Kitchen Starter Bundle', shopId: homeShop.shopId } });
    if (existingBundle) {
      info('bundle "Kitchen Starter Bundle" (already present)');
    } else {
      const bundle = await prisma.bundleDeal.create({
        data: {
          shopId: homeShop.shopId,
          title: 'Kitchen Starter Bundle',
          description: 'Cookware set + basmati rice — save when you buy together.',
          dealType: 'BUNDLE',
          buyQuantity: 2,
          getConfigQty: 1,
          discountPercent: new Prisma.Decimal(15),
          isActive: true,
          startsAt: daysFromNow(-1),
          endsAt: daysFromNow(30),
          items: {
            create: [
              { productId: cookwareId, quantity: 1 },
              { productId: riceId, quantity: 1 },
            ],
          },
        },
      });
      info(`bundle "${bundle.title}"`);
    }
  }
}
