import { Router } from 'express';

import authRoutes from '../modules/auth/auth.routes';
import usersRoutes from '../modules/users/users.routes';
import catalogRoutes from '../modules/catalog/catalog.routes';
import productRoutes from '../modules/products/product.routes';
import sellerRoutes from '../modules/sellers/seller.routes';
import cartRoutes from '../modules/cart/cart.routes';
import orderRoutes from '../modules/orders/order.routes';
import returnRoutes from '../modules/returns/return.routes';
import paymentRoutes from '../modules/payments/payment.routes';
import reviewRoutes from '../modules/reviews/review.routes';
import wishlistRoutes from '../modules/wishlist/wishlist.routes';
import notificationRoutes from '../modules/notifications/notification.routes';
import searchRoutes from '../modules/search/search.routes';
import recommendationRoutes from '../modules/recommendations/recommendation.routes';
import aiRoutes from '../modules/ai/ai.routes';
import ticketRoutes from '../modules/support/ticket.routes';
import voucherRoutes from '../modules/vouchers/voucher.routes';
import { flashSaleRouter, bundleRouter, bannerRouter } from '../modules/promotions/promo.routes';
import loyaltyRoutes from '../modules/loyalty/loyalty.routes';
import referralRoutes from '../modules/referrals/referral.routes';
import sponsoredRoutes from '../modules/sponsored/sponsored.routes';
import adminRoutes from '../modules/admin/admin.routes';
import financeRoutes from '../modules/finance/finance.routes';

const api = Router();

api.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok', time: new Date().toISOString() } }));

api.use('/auth', authRoutes);
api.use('/users', usersRoutes);
api.use('/catalog', catalogRoutes);
api.use('/products', productRoutes);
api.use('/sellers', sellerRoutes);
api.use('/cart', cartRoutes);
api.use('/orders', orderRoutes);
api.use('/returns', returnRoutes);
api.use('/payments', paymentRoutes);
api.use('/reviews', reviewRoutes);
api.use('/wishlist', wishlistRoutes);
api.use('/notifications', notificationRoutes);
api.use('/search', searchRoutes);
api.use('/recommendations', recommendationRoutes);
api.use('/ai', aiRoutes);
api.use('/support', ticketRoutes);
api.use('/vouchers', voucherRoutes);
api.use('/flash-sales', flashSaleRouter);
api.use('/bundles', bundleRouter);
api.use('/banners', bannerRouter);
api.use('/loyalty', loyaltyRoutes);
api.use('/referrals', referralRoutes);
api.use('/sponsored', sponsoredRoutes);
api.use('/admin', adminRoutes);
api.use('/finance', financeRoutes);

export default api;
