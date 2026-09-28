/** Static help-centre content. Keys are the /help/<slug> routes.
 *  Kept in code (not the DB) so the pages stay fast and SEO friendly. */

export interface HelpTopic {
  slug: string;
  title: string;
  description: string;
  updated: string;
  sections: Array<{ heading: string; body: string }>;
}

export const helpTopics: HelpTopic[] = [
  {
    slug: 'ordering',
    title: 'Placing & tracking orders',
    description: 'How checkout, order splitting and tracking work.',
    updated: '2026-09-01',
    sections: [
      {
        heading: 'Cart to checkout',
        body: 'Your cart can hold items from many shops. At checkout the order is automatically split into one sub-order per shop — you pay once, but each shop ships and handles returns for its own parcel.',
      },
      {
        heading: 'Order confirmation',
        body: 'After placing an order you get an order number (ORD-…). Open Account → My orders to see every sub-order, its status and the courier tracking number once it ships.',
      },
      {
        heading: 'Auto-cancellation',
        body: 'Card or installment orders that are not paid within the hold window are cancelled automatically and reserved stock is released. Cash-on-delivery orders can be cancelled any time before they are shipped.',
      },
    ],
  },
  {
    slug: 'payments',
    title: 'Payments & wallet',
    description: 'Cards, installments, wallet and cash on delivery.',
    updated: '2026-09-01',
    sections: [
      {
        heading: 'What methods can I use?',
        body: 'Credit/debit cards and monthly installment plans are processed securely by Stripe. You can also pay from your MarketPlace wallet or choose cash on delivery where the seller supports it.',
      },
      {
        heading: 'Wallet',
        body: 'Top up your wallet from Account → Wallet. Wallet balance can pay for any order and is also where refunds to balance land. Wallet payments debit immediately and are confirmed instantly.',
      },
      {
        heading: 'Installments',
        body: 'For eligible orders you can split the total over 3, 6 or 12 months. A 20% upfront payment is taken at checkout and the remaining balance is billed monthly by Stripe.',
      },
    ],
  },
  {
    slug: 'returns',
    title: 'Returns & refunds',
    description: 'Windows, conditions and how fast money comes back.',
    updated: '2026-09-01',
    sections: [
      {
        heading: 'Return window',
        body: 'Each product shows its return window (typically 7–30 days from delivery, set by the shop). Open Account → Returns, pick the delivered item and tell us why.',
      },
      {
        heading: 'Refund timing',
        body: 'Approved returns are refunded once the seller receives the item. Card refunds take 5–10 business days to appear with your bank; wallet refunds are instant.',
      },
      {
        heading: 'Non-returnable items',
        body: 'Perishables, sealed hygiene products and customised items may be excluded by the seller — the product page and your order item both show whether a return is allowed.',
      },
    ],
  },
  {
    slug: 'shipping',
    title: 'Shipping & delivery',
    description: 'Fees, free-shipping thresholds and timelines.',
    updated: '2026-09-01',
    sections: [
      {
        heading: 'Shipping fees',
        body: 'Each shop charges shipping per parcel. Orders above the platform free-shipping threshold ship free; faster-dispatch shops may apply an express multiplier.',
      },
      {
        heading: 'Delivery time',
        body: 'Every shop lists its estimated delivery days. The order page shows the projected date, which updates as the seller confirms and ships your parcel.',
      },
    ],
  },
  {
    slug: 'seller-policies',
    title: 'Seller policies',
    description: 'What we expect from shops on MarketPlace.',
    updated: '2026-09-01',
    sections: [
      {
        heading: 'Product standards',
        body: 'List only items you are licensed to sell, with accurate titles, real photos and truthful condition grades. Counterfeit or prohibited items are removed and repeated breaches end the shop.',
      },
      {
        heading: 'Dispatch & service',
        body: 'Confirm orders within your stated handling time, ship with tracking, and answer buyer questions promptly. Seller tiers (Bronze → Platinum) depend on on-time dispatch, cancellation rate and rating.',
      },
      {
        heading: 'Fees & payouts',
        body: 'A per-category commission applies to delivered sales. Earnings (net of commission) become withdrawable after the returns window; request bank payouts from the seller dashboard.',
      },
    ],
  },
  {
    slug: 'privacy',
    title: 'Privacy notice',
    description: 'What data we collect and why.',
    updated: '2026-09-01',
    sections: [
      {
        heading: 'Data we collect',
        body: 'Account details (name, email, phone), delivery addresses, order history, reviews you post, and basic usage data. Payment card numbers never touch our servers — Stripe handles them.',
      },
      {
        heading: 'How it is used',
        body: 'To process orders, prevent fraud, personalise search and recommendations, and send transactional notifications. Marketing emails are opt-in and one-click unsubscribable.',
      },
      {
        heading: 'Your rights',
        body: 'Export or delete your account from Account → Settings, or contact support. We keep order records only as long as tax law requires.',
      },
    ],
  },
  {
    slug: 'terms',
    title: 'Terms of use',
    description: 'The rules for using the marketplace.',
    updated: '2026-09-01',
    sections: [
      {
        heading: 'Marketplace role',
        body: 'MarketPlace connects buyers and independent sellers. Sellers are responsible for their products, fulfilment and returns; we operate the platform and payment rails.',
      },
      {
        heading: 'Your account',
        body: 'Keep credentials safe, provide accurate details, and be at least 18 (or have guardian consent). Accounts used for abuse, resale of restricted goods or payment fraud are suspended.',
      },
      {
        heading: 'Orders & pricing',
        body: 'Prices, stock and promo availability can change until an order is placed. Obvious pricing errors may be cancelled with full refund.',
      },
    ],
  },
  {
    slug: 'cookies',
    title: 'Cookie policy',
    description: 'Browsers storage we use and why.',
    updated: '2026-09-01',
    sections: [
      {
        heading: 'Strictly necessary',
        body: 'Session cookies that keep you signed in and secure (NextAuth) and short-lived cart state. These cannot be disabled.',
      },
      {
        heading: 'Analytics & preferences',
        body: 'We use first-party analytics to understand search and purchase behaviour, and remember display preferences like your last viewed category.',
      },
    ],
  },
  {
    slug: 'contact',
    title: 'Contact us',
    description: 'Reach the support team.',
    updated: '2026-09-01',
    sections: [
      {
        heading: 'Live chat & tickets',
        body: 'Signed-in buyers can open a support ticket from Account → Support or use live chat — average first reply is under 10 minutes during business hours (Mon–Sat, 9:00–18:00).',
      },
      {
        heading: 'Email & phone',
        body: 'Email support@marketplace.example or call +94 11 234 5678. For order issues, keep your ORD- number handy so we can act immediately.',
      },
    ],
  },
];

export function getHelpTopic(slug: string): HelpTopic | undefined {
  return helpTopics.find((t) => t.slug === slug);
}
