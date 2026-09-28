'use client';

import { useState } from 'react';
import { Wallet, Coins, ArrowDownLeft, ArrowUpRight, Snowflake } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/shared/stat-card';
import { CardConfirm } from '@/components/shared/card-confirm';
import { useWallet, useWalletTopup, useLoyalty } from '@/hooks/use-account';
import { formatMoney, num, formatDate } from '@/lib/utils';
import type { WalletTx } from '@/types';

const QUICK_AMOUNTS = [500, 1000, 2500, 5000];

export default function WalletPage() {
  const { data: wallet, isLoading } = useWallet();
  const { data: loyalty } = useLoyalty();
  const topup = useWalletTopup();
  const [amount, setAmount] = useState('1000');
  const [intent, setIntent] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const balance = num(wallet?.balance ?? 0);
  const frozen = wallet?.isFrozen;
  const txs = (wallet?.transactions ?? []) as unknown as WalletTx[];
  const parsedAmount = num(amount);

  const startTopup = () => {
    if (!parsedAmount || parsedAmount <= 0) return;
    topup.mutate(parsedAmount, {
      onSuccess: (res) => setIntent(res.clientSecret),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Wallet &amp; rewards</h1>
        <p className="text-sm text-muted-foreground">
          Manage your balance, top up instantly and track loyalty points.
        </p>
      </div>

      {frozen && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Snowflake className="h-4 w-4" />
          Your wallet is temporarily frozen. Contact support to restore it.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Wallet balance" value={formatMoney(balance)} icon={Wallet} />
        <StatCard
          label="Loyalty points"
          value={(loyalty?.points ?? 0).toLocaleString()}
          hint={loyalty ? `≈ ${formatMoney(loyalty.currencyValue)}` : undefined}
          icon={Coins}
        />
        <StatCard label="Coins" value={(loyalty?.coins ?? 0).toLocaleString()} icon={Coins} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Top up wallet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {intent ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Confirm your card to add{' '}
                  <span className="font-semibold text-foreground">{formatMoney(parsedAmount)}</span>{' '}
                  to your wallet.
                </p>
                <CardConfirm
                  clientSecret={intent}
                  onDone={() => {
                    setIntent(null);
                    window.location.reload();
                  }}
                />
                <Button variant="ghost" size="sm" onClick={() => setIntent(null)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2">
                  {QUICK_AMOUNTS.map((q) => (
                    <Button
                      key={q}
                      type="button"
                      variant={parsedAmount === q ? 'brand' : 'outline'}
                      size="sm"
                      onClick={() => setAmount(String(q))}
                    >
                      {formatMoney(q, { decimals: false })}
                    </Button>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="topup-amount">Amount</Label>
                  <Input
                    id="topup-amount"
                    type="number"
                    min={1}
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <Button
                  variant="brand"
                  className="w-full"
                  disabled={topup.isPending || !parsedAmount || parsedAmount <= 0}
                  onClick={startTopup}
                >
                  {topup.isPending ? 'Preparing…' : `Add ${formatMoney(parsedAmount)} now`}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Card payment is processed securely by Stripe and credited automatically.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Loyalty rewards</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {loyalty ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Available to redeem</span>
                  <span className="font-semibold">{loyalty.points.toLocaleString()} pts</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Minimum to redeem</span>
                  <span className="font-semibold">{loyalty.redeemMinPoints.toLocaleString()} pts</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Max per order</span>
                  <span className="font-semibold">{loyalty.maxRedeemPercent}% of subtotal</span>
                </div>
                <Badge variant={loyalty.canRedeem ? 'success' : 'secondary'}>
                  {loyalty.canRedeem ? 'Redeem at checkout' : 'Keep shopping to unlock'}
                </Badge>
                <p className="pt-1 text-xs text-muted-foreground">
                  Points are applied automatically on the checkout page when eligible.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">No rewards data yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Recent transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {txs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No wallet activity yet.</p>
          ) : (
            <div className="divide-y">
              {txs.slice(0, 15).map((t) => {
                const credit = t.type === 'CREDIT';
                return (
                  <div key={t.id} className="flex items-center gap-3 py-3">
                    <div
                      className={
                        credit
                          ? 'flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-green-700'
                          : 'flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-700'
                      }
                    >
                      {credit ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.description ?? t.purpose}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(t.createdAt, true)}</p>
                    </div>
                    <div className="text-right">
                      <p className={credit ? 'text-sm font-semibold text-green-600' : 'text-sm font-semibold text-red-600'}>
                        {credit ? '+' : '−'}
                        {formatMoney(num(t.amount))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        bal {formatMoney(num(t.balanceAfter))}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
