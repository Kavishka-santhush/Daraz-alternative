import Link from 'next/link';
import { CreditCard, Headphones, PackageSearch, RotateCcw } from 'lucide-react';
import { helpTopics } from '@/lib/help-content';

export const metadata = {
  title: 'Help Centre',
  description: 'Guides for orders, payments, returns, shipping and selling.',
};

const popular = [
  { slug: 'ordering', label: 'Where is my order?', icon: PackageSearch },
  { slug: 'returns', label: 'Start a return', icon: RotateCcw },
  { slug: 'payments', label: 'Payment problems', icon: CreditCard },
  { slug: 'contact', label: 'Talk to support', icon: Headphones },
];

export default function HelpIndexPage() {
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold sm:text-3xl">How can we help?</h1>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {popular.map((p) => (
            <Link
              key={p.slug}
              href={`/help/${p.slug}`}
              className="flex items-center gap-2 rounded-lg border bg-card p-3 text-sm font-medium hover:border-brand hover:text-brand"
            >
              <p.icon className="h-4 w-4 text-brand" />
              {p.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">All topics</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {helpTopics.map((t) => (
            <Link
              key={t.slug}
              href={`/help/${t.slug}`}
              className="rounded-lg border bg-card p-4 transition-colors hover:border-brand"
            >
              <p className="font-semibold">{t.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
