import Link from 'next/link';
import { Facebook, Instagram, Twitter } from 'lucide-react';

const columns = [
  {
    title: 'Shop',
    links: [
      { label: 'All Products', href: '/search' },
      { label: 'Flash Sales', href: '/flash-sale' },
      { label: 'Daily Deals', href: '/deals' },
      { label: 'Vouchers & Offers', href: '/offers' },
    ],
  },
  {
    title: 'Sell',
    links: [
      { label: 'Open a Shop', href: '/sell' },
      { label: 'Seller Dashboard', href: '/seller' },
      { label: 'Seller Policies', href: '/help/seller-policies' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Help Center', href: '/help' },
      { label: 'Track Order', href: '/account/orders' },
      { label: 'Returns & Refunds', href: '/help/returns' },
      { label: 'Contact Us', href: '/help/contact' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'My Account', href: '/account' },
      { label: 'Wishlist', href: '/account/wishlist' },
      { label: 'Wallet', href: '/account/wallet' },
      { label: 'Sign In', href: '/login' },
    ],
  },
];

/** Storefront footer: link columns, socials, legal. */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t bg-muted/40">
      <div className="container grid grid-cols-2 gap-8 py-12 md:grid-cols-4 lg:grid-cols-5">
        <div className="col-span-2 lg:col-span-1">
          <div className="flex items-center gap-1 text-lg font-extrabold">
            <span className="text-brand">Market</span>
            <span className="-ml-2">Place</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Your multi-vendor marketplace — discover millions of products from trusted sellers.
          </p>
          <div className="mt-4 flex items-center gap-3 text-muted-foreground">
            <Link href="https://facebook.com" aria-label="Facebook" className="hover:text-brand"><Facebook className="h-5 w-5" /></Link>
            <Link href="https://instagram.com" aria-label="Instagram" className="hover:text-brand"><Instagram className="h-5 w-5" /></Link>
            <Link href="https://twitter.com" aria-label="Twitter" className="hover:text-brand"><Twitter className="h-5 w-5" /></Link>
          </div>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="text-sm font-semibold">{col.title}</h4>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-muted-foreground hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t">
        <div className="container flex flex-col items-center justify-between gap-2 py-4 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} MarketPlace. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/help/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/help/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/help/cookies" className="hover:text-foreground">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
