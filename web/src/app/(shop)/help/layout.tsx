import Link from 'next/link';
import { BookOpen, MessageCircleQuestion } from 'lucide-react';
import { helpTopics } from '@/lib/help-content';

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container grid gap-8 py-8 lg:grid-cols-[240px_1fr]">
      <aside className="h-fit space-y-1 lg:sticky lg:top-20">
        <p className="flex items-center gap-2 px-2 pb-2 text-sm font-semibold">
          <BookOpen className="h-4 w-4 text-brand" /> Help Centre
        </p>
        <nav className="space-y-0.5">
          {helpTopics.map((t) => (
            <Link
              key={t.slug}
              href={`/help/${t.slug}`}
              className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {t.title}
            </Link>
          ))}
        </nav>
        <div className="mt-4 rounded-lg border bg-card p-3 text-xs text-muted-foreground">
          <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
            <MessageCircleQuestion className="h-3.5 w-3.5 text-brand" /> Still stuck?
          </p>
          Open a support ticket from your account or{' '}
          <Link href="/help/contact" className="text-brand hover:underline">
            contact us
          </Link>
          .
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
