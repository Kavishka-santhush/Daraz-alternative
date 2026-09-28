import { prisma, section, info, disconnect, DEMO_PASSWORD } from './helpers';
import { seedSettings } from './settings.seed';
import { seedCatalog } from './catalog.seed';
import { seedUsers } from './users.seed';
import { seedProducts } from './products.seed';
import { seedPromos } from './promos.seed';
import { seedContent } from './content.seed';

/**
 * Full database seeder. Run with `npm run db:seed` (tsx prisma/seeds/index.ts).
 * Every step is idempotent (upsert / find-then-create) so it can be re-run.
 */
async function main() {
  const started = Date.now();
  console.log('\n========================================');
  console.log('  MarketPlace — database seed');
  console.log('========================================');

  await seedSettings();
  const catalog = await seedCatalog();
  const users = await seedUsers();
  const products = await seedProducts(catalog, users);
  await seedPromos(catalog, products, users);
  await seedContent(products, users);

  section('Summary');
  const counts = {
    users: await prisma.user.count(),
    sellers: await prisma.sellerProfile.count(),
    shops: await prisma.shop.count(),
    categories: await prisma.category.count(),
    products: await prisma.product.count(),
    variants: await prisma.productVariant.count(),
    vouchers: await prisma.voucher.count(),
    reviews: await prisma.review.count(),
  };
  info(`users=${counts.users} sellers=${counts.sellers} shops=${counts.shops}`);
  info(`categories=${counts.categories} products=${counts.products} variants=${counts.variants}`);
  info(`vouchers=${counts.vouchers} reviews=${counts.reviews}`);

  console.log('\nDemo login (all accounts share this password):');
  console.log(`  password: ${DEMO_PASSWORD}`);
  console.log('  staff : super@marketplace.local | admin@ | ops@ | support@ | finance@');
  console.log('  seller: seller@marketplace.local (TechHub) | fashion@ | home@');
  console.log('  buyer : buyer@marketplace.local | ana@ | bob@');
  console.log(`\nDone in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
}

main()
  .catch((err) => {
    console.error('\nSeed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnect();
  });
