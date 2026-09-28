'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  BadgePercent,
  Banknote,
  CalendarClock,
  Check,
  CreditCard,
  Loader2,
  Lock,
  Plus,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { QuantityStepper } from '@/components/shared/quantity-stepper';
import { EmptyState } from '@/components/shared/empty-state';
import { useCart } from '@/components/providers/cart-provider';
import { apiGet, apiPost, ApiClientError } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { formatMoney, num } from '@/lib/utils';
import { mediaUrl } from '@/lib/env';
import type { Address, CheckoutResult, MeUser, WalletInfo } from '@/types';

/* ── Payment methods ─────────────────────────────────────────── */

type Method = 'CARD' | 'WALLET' | 'COD' | 'INSTALLMENTS';
type Plan = 'MONTH_3' | 'MONTH_6' | 'MONTH_12';

const PLANS: Array<{ id: Plan; months: number; label: string }> = [
  { id: 'MONTH_3', months: 3, label: '3 months' },
  { id: 'MONTH_6', months: 6, label: '6 months' },
  { id: 'MONTH_12', months: 12, label: '12 months' },
];

/* ── Address form (mirrors server users.routes addressBody) ─── */

const addressSchema = z.object({
  label: z.string().max(40).optional(),
  contactName: z.string().min(2, 'Required').max(120),
  contactPhone: z.string().min(6, 'Enter a valid phone').max(20),
  line1: z.string().min(3, 'Street address is required').max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1, 'City is required').max(100),
  district: z.string().max(100).optional(),
  province: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
});

type AddressFormValues = z.infer<typeof addressSchema>;

function NewAddressDialog({ onCreated }: { onCreated: (a: Address) => void }) {
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddressFormValues>({ resolver: zodResolver(addressSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const created = await apiPost<Address>('/users/me/addresses', values);
      toast.success('Address saved');
      onCreated(created);
      reset();
      setOpen(false);
    } catch (e) {
      toast.error('Could not save address', {
        description: e instanceof ApiClientError ? e.message : 'Please try again.',
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Plus className="h-4 w-4" /> New address
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Delivery address</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contactName">Contact name</Label>
              <Input id="contactName" {...register('contactName')} />
              {errors.contactName && <p className="text-xs text-destructive">{errors.contactName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contactPhone">Phone</Label>
              <Input id="contactPhone" {...register('contactPhone')} />
              {errors.contactPhone && <p className="text-xs text-destructive">{errors.contactPhone.message}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="line1">Address line 1</Label>
            <Input id="line1" placeholder="Street, building, number" {...register('line1')} />
            {errors.line1 && <p className="text-xs text-destructive">{errors.line1.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="line2">Address line 2 (optional)</Label>
            <Input id="line2" placeholder="Apartment, floor, landmark" {...register('line2')} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" {...register('city')} />
              {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="district">District</Label>
              <Input id="district" {...register('district')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="postalCode">Postal code</Label>
              <Input id="postalCode" {...register('postalCode')} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="province">Province</Label>
              <Input id="province" {...register('province')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="label">Label (optional)</Label>
              <Input id="label" placeholder="Home, Office…" {...register('label')} />
            </div>
          </div>
          <Button type="submit" variant="brand" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Save address
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Page ────────────────────────────────────────────────────── */

export default function CheckoutPage() {
  const router = useRouter();
  const { status } = useSession();
  const qc = useQueryClient();
  const { cart, isLoading: cartLoading } = useCart();

  const [addressId, setAddressId] = useState<string | null>(null);
  const [method, setMethod] = useState<Method>('CARD');
  const [plan, setPlan] = useState<Plan>('MONTH_3');
  const [useLoyalty, setUseLoyalty] = useState(false);
  const [buyerNotes, setBuyerNotes] = useState('');
  /** Voucher codes keyed by shopId, or 'PLATFORM' for the site-wide code. */
  const [vouchers, setVouchers] = useState<Record<string, string>>({});

  const addressesQ = useQuery({
    queryKey: queryKeys.addresses,
    queryFn: () => apiGet<Address[]>('/users/me/addresses'),
    enabled: status === 'authenticated',
  });

  const walletQ = useQuery({
    queryKey: queryKeys.wallet,
    queryFn: () => apiGet<WalletInfo>('/payments/wallet'),
    enabled: status === 'authenticated',
  });

  const meQ = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => apiGet<MeUser>('/auth/me'),
    enabled: status === 'authenticated',
  });

  // Pick the default address once the list loads.
  useEffect(() => {
    if (!addressId && addressesQ.data?.length) {
      setAddressId((addressesQ.data.find((a) => a.isDefault) ?? addressesQ.data[0]).id);
    }
  }, [addressesQ.data, addressId]);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login?callbackUrl=/checkout');
  }, [status, router]);

  const subtotal = cart?.subtotal ?? 0;
  const walletBalance = num(walletQ.data?.balance);
  const loyaltyPoints = meQ.data?.loyaltyPoints ?? 0;
  const loyaltyCap = Math.round(subtotal * 0.1); // conservative cap; server is authoritative
  const estimatedDiscount = useLoyalty ? Math.min(loyaltyPoints, loyaltyCap) : 0;
  const estimatedTotal = Math.max(0, subtotal - estimatedDiscount);

  const groups = useMemo(() => cart?.groups ?? [], [cart]);

  const checkoutMut = useMutation({
    mutationFn: () => {
      if (!addressId) throw new Error('Select a delivery address');
      if (method === 'INSTALLMENTS' && !plan) throw new Error('Select an installment plan');
      const trimmed: Record<string, string> = {};
      for (const [k, v] of Object.entries(vouchers)) if (v.trim()) trimmed[k] = v.trim().toUpperCase();
      return apiPost<CheckoutResult>(
        '/orders/checkout',
        {
          addressId,
          paymentMethod: method,
          ...(method === 'INSTALLMENTS' ? { installmentPlan: plan } : {}),
          ...(Object.keys(trimmed).length ? { vouchers: trimmed } : {}),
          ...(useLoyalty ? { useLoyalty: true } : {}),
          ...(buyerNotes.trim() ? { buyerNotes: buyerNotes.trim() } : {}),
        },
      );
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: queryKeys.cart });
      qc.invalidateQueries({ queryKey: queryKeys.wallet });
      qc.invalidateQueries({ queryKey: queryKeys.me });
      const params = new URLSearchParams();
      if (res.payment.clientSecret) params.set('intent', res.payment.clientSecret);
      router.push(`/account/orders/${res.order.orderNumber}?${params.toString()}`);
    },
    onError: (e) => {
      toast.error('Checkout failed', {
        description: e instanceof ApiClientError ? e.message : e.message || 'Please try again.',
      });
    },
  });

  if (status !== 'authenticated') {
    return (
      <div className="container py-16">
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
          <p className="text-sm text-muted-foreground">Checking your session…</p>
        </div>
      </div>
    );
  }

  if (cartLoading) {
    return (
      <div className="container grid gap-6 py-8 lg:grid-cols-[1fr_380px]">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!groups.length) {
    return (
      <div className="container py-16">
        <EmptyState
          title="Your cart is empty"
          description="Add some products to your cart before checking out."
          action={
            <Button asChild variant="brand">
              <Link href="/">Start shopping</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const methods: Array<{ id: Method; label: string; hint: string; icon: React.ReactNode }> = [
    { id: 'CARD', label: 'Credit / Debit card', hint: 'Secure 3-D Secure payment via Stripe', icon: <CreditCard className="h-4 w-4" /> },
    {
      id: 'WALLET',
      label: 'MarketPlace wallet',
      hint: walletBalance > 0 ? `Balance ${formatMoney(walletBalance)}` : 'Top up from your account',
      icon: <Wallet className="h-4 w-4" />,
    },
    { id: 'COD', label: 'Cash on delivery', hint: 'Pay in cash when your order arrives', icon: <Banknote className="h-4 w-4" /> },
    { id: 'INSTALLMENTS', label: 'Installments', hint: 'Split the total into monthly payments', icon: <CalendarClock className="h-4 w-4" /> },
  ];

  return (
    <div className="container grid gap-6 py-8 lg:grid-cols-[1fr_400px]">
      <div className="space-y-6">
        {/* ── 1. Delivery address ── */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">1 · Delivery address</CardTitle>
            <NewAddressDialog
              onCreated={(a) => {
                setAddressId(a.id);
                qc.invalidateQueries({ queryKey: queryKeys.addresses });
              }}
            />
          </CardHeader>
          <CardContent>
            {addressesQ.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : !addressesQ.data?.length ? (
              <p className="text-sm text-muted-foreground">
                Add a delivery address to continue.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {addressesQ.data.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAddressId(a.id)}
                    className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                      addressId === a.id
                        ? 'border-brand bg-brand/5 ring-1 ring-brand'
                        : 'hover:border-muted-foreground/40'
                    }`}
                  >
                    <div className="mb-0.5 flex items-center justify-between gap-2">
                      <span className="font-semibold">
                        {a.label || a.contactName}
                        {a.isDefault && <span className="ml-2 text-xs font-normal text-muted-foreground">Default</span>}
                      </span>
                      {addressId === a.id && <Check className="h-4 w-4 text-brand" />}
                    </div>
                    <p className="text-muted-foreground">{a.contactName} · {a.contactPhone}</p>
                    <p className="line-clamp-2 text-muted-foreground">
                      {a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}
                      {a.postalCode ? ` (${a.postalCode})` : ''}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── 2. Payment method ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2 · Payment method</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {methods.map((m) => {
                const disabled =
                  (m.id === 'WALLET' && walletBalance < estimatedTotal) ||
                  (m.id === 'INSTALLMENTS' && estimatedTotal < 5000);
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setMethod(m.id)}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      method === m.id
                        ? 'border-brand bg-brand/5 ring-1 ring-brand'
                        : 'hover:border-muted-foreground/40'
                    }`}
                  >
                    <span className="mt-0.5 text-brand">{m.icon}</span>
                    <span>
                      <span className="block font-semibold">{m.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {m.id === 'WALLET' && disabled
                          ? 'Insufficient wallet balance'
                          : m.id === 'INSTALLMENTS' && disabled
                            ? 'Available for orders over Rs 5,000'
                            : m.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {method === 'INSTALLMENTS' && (
              <div className="grid gap-2 sm:grid-cols-3">
                {PLANS.map((p) => {
                  const upfront = Math.round(estimatedTotal * 0.2);
                  const perMonth = Math.round((estimatedTotal - upfront) / p.months);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlan(p.id)}
                      className={`rounded-lg border p-3 text-left text-sm ${
                        plan === p.id ? 'border-brand bg-brand/5 ring-1 ring-brand' : 'hover:border-muted-foreground/40'
                      }`}
                    >
                      <span className="block font-semibold">{p.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatMoney(perMonth)}/mo after {formatMoney(upfront)} upfront
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {method === 'CARD' && (
              <p className="flex items-center gap-1.5 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                After placing the order you&apos;ll enter your card on a secure Stripe screen.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── 3. Items ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3 · Order items ({cart?.itemCount ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {groups.map((g) => (
              <div key={g.shop.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{g.shop.name}</p>
                  {/* Platform vouchers apply to any group; seller ones keyed by shop id. */}
                  <div className="flex items-center gap-1.5">
                    <BadgePercent className="h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={vouchers[g.shop.id] ?? ''}
                      onChange={(e) => setVouchers((v) => ({ ...v, [g.shop.id]: e.target.value }))}
                      placeholder="Shop voucher code"
                      className="h-8 w-36 text-xs"
                    />
                  </div>
                </div>
                {g.items.map((it) => (
                  <div key={it.id} className="flex items-center gap-3 rounded-lg border p-2">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                      {it.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaUrl(it.image)} alt={it.title} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-medium">{it.title}</p>
                      <p className="text-xs text-muted-foreground">{formatMoney(it.unitPrice)} each</p>
                    </div>
                    <QuantityStepper value={it.quantity} max={it.stock} disabled className="scale-90" />
                    <p className="w-24 text-right text-sm font-semibold">{formatMoney(it.lineTotal)}</p>
                  </div>
                ))}
                <Separator />
              </div>
            ))}

            <div className="space-y-1.5">
              <Label htmlFor="platform-voucher">Platform voucher code (optional)</Label>
              <Input
                id="platform-voucher"
                value={vouchers.PLATFORM ?? ''}
                onChange={(e) => setVouchers((v) => ({ ...v, PLATFORM: e.target.value }))}
                placeholder="e.g. WELCOME10"
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground">
                Eligible codes are applied when you place the order.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Order notes (optional)</Label>
              <Textarea
                id="notes"
                rows={2}
                maxLength={500}
                value={buyerNotes}
                onChange={(e) => setBuyerNotes(e.target.value)}
                placeholder="Delivery instructions, gift message…"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Summary ── */}
      <Card className="h-fit lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle className="text-base">Order summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>Calculated per shop</span>
            </div>
            {estimatedDiscount > 0 && (
              <div className="flex justify-between text-brand">
                <span>Loyalty redemption</span>
                <span>-{formatMoney(estimatedDiscount)}</span>
              </div>
            )}
          </div>

          {loyaltyPoints > 0 && (
            <label className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
              <Checkbox
                checked={useLoyalty}
                onCheckedChange={(c) => setUseLoyalty(c === true)}
                disabled={loyaltyPoints < 100}
              />
              <span className="flex-1">
                Use loyalty points
                <span className="block text-xs text-muted-foreground">
                  {loyaltyPoints.toLocaleString()} points available (max {formatMoney(loyaltyCap)} this order)
                </span>
              </span>
            </label>
          )}

          <Separator />
          <div className="flex items-baseline justify-between">
            <span className="font-semibold">Estimated total</span>
            <span className="text-xl font-bold text-brand">{formatMoney(estimatedTotal)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Final shipping, taxes and voucher discounts are confirmed when the order is placed.
          </p>

          <Button
            variant="brand"
            className="w-full"
            size="lg"
            disabled={!addressId || checkoutMut.isPending}
            onClick={() => checkoutMut.mutate()}
          >
            {checkoutMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            {method === 'COD'
              ? 'Place order'
              : checkoutMut.isPending
                ? 'Placing order…'
                : `Place order · ${formatMoney(estimatedTotal)}`}
          </Button>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">Buyer protection</Badge>
            <Badge variant="outline">Secure checkout</Badge>
            <Badge variant="outline">{groups.length} shop{groups.length > 1 ? 's' : ''}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
