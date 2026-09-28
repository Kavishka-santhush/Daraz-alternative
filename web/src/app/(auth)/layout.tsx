import Link from 'next/link';

/** Centered card layout for login / register / password screens. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="container flex h-16 items-center">
        <Link href="/" className="flex items-center gap-1 text-xl font-extrabold tracking-tight">
          <span className="text-brand">Market</span>
          <span className="-ml-3">Place</span>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <footer className="container py-4 text-center text-xs text-muted-foreground">
        <Link href="/" className="hover:text-brand">← Back to store</Link>
      </footer>
    </div>
  );
}
