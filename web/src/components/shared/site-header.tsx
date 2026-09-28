'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, ShoppingCart, X, Zap, Tag, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SearchBar } from '@/components/shared/search-bar';
import { UserNav } from '@/components/shared/user-nav';
import { useCart } from '@/components/providers/cart-provider';
import { cn } from '@/lib/utils';
import type { Category } from '@/types';

interface SiteHeaderProps {
  categories?: Category[];
}

/** Top-level storefront header: logo, category menu, search, cart, account. */
export function SiteHeader({ categories = [] }: SiteHeaderProps) {
  const { itemCount } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="container flex h-16 items-center gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="text-xl font-extrabold tracking-tight text-brand">Market</span>
          <span className="-ml-3 text-xl font-extrabold tracking-tight">Place</span>
        </Link>

        {/* Category dropdown (desktop) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="hidden shrink-0 lg:inline-flex">
              <Menu className="h-4 w-4" /> Categories
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            {categories.length === 0 && (
              <DropdownMenuItem disabled>No categories yet</DropdownMenuItem>
            )}
            {categories.map((c) => (
              <DropdownMenuItem key={c.id} asChild>
                <Link href={`/category/${c.slug}`}>{c.name}</Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <nav className="hidden shrink-0 items-center gap-1 md:flex">
          <Link href="/flash-sale" className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent">
            <Zap className="h-4 w-4 text-brand" /> Flash Sale
          </Link>
          <Link href="/deals" className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent">
            <Tag className="h-4 w-4 text-brand" /> Deals
          </Link>
          <Link href="/sell" className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent">
            <Store className="h-4 w-4 text-brand" /> Sell
          </Link>
        </nav>

        <div className="hidden flex-1 md:block">
          <SearchBar />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
          <Button asChild variant="ghost" size="icon" className="relative">
            <Link href="/cart" aria-label="Cart">
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>
          </Button>
          <UserNav />
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile search + nav */}
      <div className={cn('border-t bg-background md:hidden', mobileOpen ? 'block' : 'hidden')}>
        <div className="container space-y-3 py-3">
          <SearchBar />
          <nav className="grid grid-cols-3 gap-2 text-sm">
            <Link href="/flash-sale" className="rounded-md border p-2 text-center">Flash Sale</Link>
            <Link href="/deals" className="rounded-md border p-2 text-center">Deals</Link>
            <Link href="/sell" className="rounded-md border p-2 text-center">Sell</Link>
          </nav>
          {categories.length > 0 && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              {categories.map((c) => (
                <Link key={c.id} href={`/category/${c.slug}`} className="rounded-md bg-muted p-2">
                  {c.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
