'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { LogOut, Package, Heart, Wallet, Store, LayoutDashboard, Settings, ShieldCheck, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { initials } from '@/lib/utils';

/** Account dropdown: buyer links + role-aware staff/seller dashboards. */
export function UserNav() {
  const { data, status } = useSession();

  if (status !== 'authenticated' || !data?.user) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">Sign in</span>
          </Link>
        </Button>
        <Button asChild variant="brand" size="sm">
          <Link href="/register">Register</Link>
        </Button>
      </div>
    );
  }

  const user = data.user;
  const role = user.role;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name ?? ''} />
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="truncate font-medium">{user.name}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/account" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" /> Account overview
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/orders" className="flex items-center gap-2">
            <Package className="h-4 w-4" /> My orders
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/wishlist" className="flex items-center gap-2">
            <Heart className="h-4 w-4" /> Wishlist
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/wallet" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" /> Wallet
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" /> Settings
          </Link>
        </DropdownMenuItem>

        {role === 'SELLER' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/seller" className="flex items-center gap-2">
                <Store className="h-4 w-4" /> Seller dashboard
              </Link>
            </DropdownMenuItem>
          </>
        )}

        {(role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'OPERATIONS_MANAGER' || role === 'FINANCE_MANAGER' || role === 'SUPPORT_AGENT') && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin" className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Admin dashboard
              </Link>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="flex items-center gap-2 text-destructive focus:text-destructive"
          onSelect={() => signOut({ callbackUrl: '/' })}
        >
          <LogOut className="h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
