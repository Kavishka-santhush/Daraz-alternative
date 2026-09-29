import Link from 'next/link';
import {
  ArrowRight, Banknote, BadgeCheck, BarChart3, Package, Percent, Store, Truck, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata = {
  title: 'Sell on MarketPlace',
  description:
    'Open your own online shop with zero upfront cost — reach millions of buyers, get paid on time.',
};

const steps = [
  {
    icon: Store,
    title: '1 · Create your shop',
    body: 'Register as a seller, tell us about your business and pick a shop name. Our team reviews new shops within 24 hours.',
  },
  {
    icon: Package,
    title: '2 · List your products',
    body: 'Add products one by one or in bulk with CSV. Variants, images, attributes and per-variant stock included.',
  },
  {
    icon: Truck,
    title: '3 · Ship when orders arrive',
    body: 'Confirm orders, print invoices and hand over to your courier — tracking lives right in the dashboard.',
  },
  {
    icon: Banknote,
    title: '4 · Get paid to your bank',
    body: 'Earnings land in your seller wallet after each delivered order. Request payouts any time, no minimum drama.',
  },
];

const perks = [
  { icon: Percent, title: 'Transparent commission', body: 'Per-category rates shown before you list — no surprise fees.' },
  { icon: BarChart3, title: 'Sales analytics', body: 'Revenue, top products, conversion and traffic at a glance.' },
  { icon: BadgeCheck, title: 'Verified badge', body: 'Earn reviews and climb tiers from Bronze to Platinum.' },
  { icon: Users, title: 'Millions of buyers', body: 'Search, flash sales, vouchers and sponsored placements put you in front.' },
];

export default function SellPage() {
  return (
    <div className="container space-y-14 py-10">
      {/* Hero */}
      <section className="mx-auto max-w-3xl space-y-4 text-center">
        <Badge variant="brand">Sell on MarketPlace</Badge>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
          Turn your products into a <span className="text-brand">growing online business</span>
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          Zero listing fees. Simple per-sale commission. Tools that scale from your first order to
          your ten-thousandth.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button asChild variant="brand" size="lg">
            <Link href="/register?tab=seller">
              Open your shop <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/help/seller-policies">Read seller policies</Link>
          </Button>
        </div>
      </section>

      {/* Steps */}
      <section className="space-y-6">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <Card key={s.title}>
              <CardHeader className="pb-2">
                <s.icon className="h-8 w-8 text-brand" />
                <CardTitle className="mt-2 text-base">{s.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{s.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Perks */}
      <section className="space-y-6">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">Built for sellers</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {perks.map((p) => (
            <div key={p.title} className="rounded-xl border bg-card p-5">
              <p.icon className="h-6 w-6 text-brand" />
              <h3 className="mt-3 font-semibold">{p.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl space-y-4">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">Questions, answered</h2>
        {[
          {
            q: 'How much does it cost to sell?',
            a: 'Listing is free. We charge a commission per delivered sale — the exact percentage depends on the product category and your seller tier, and is always shown in your dashboard.',
          },
          {
            q: 'When do I receive my money?',
            a: 'After an order is delivered and the returns window closes, the amount (minus commission) moves to your seller wallet. Request a bank payout any time; finance processes requests on business days.',
          },
          {
            q: 'Who handles delivery?',
            a: 'You can ship with your own courier or use partner couriers. Add tracking numbers in the seller dashboard so buyers can follow their parcels.',
          },
          {
            q: 'Can I run my own promotions?',
            a: 'Yes — seller vouchers, bundle deals and flash-sale slots (when available) are all in the seller dashboard.',
          },
        ].map((item) => (
          <details key={item.q} className="group rounded-lg border bg-card p-4">
            <summary className="cursor-pointer list-none font-medium marker:hidden">
              {item.q}
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </section>

      {/* CTA */}
      <section className="rounded-2xl bg-brand px-6 py-10 text-center text-white">
        <h2 className="text-2xl font-bold sm:text-3xl">Your first order is waiting</h2>
        <p className="mx-auto mt-2 max-w-lg text-white/90">
          Set up takes minutes. Approval usually lands within one business day.
        </p>
        <Button asChild size="lg" className="mt-6 bg-white text-brand hover:bg-white/90">
          <Link href="/register?tab=seller">
            Start selling <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </section>
    </div>
  );
}
