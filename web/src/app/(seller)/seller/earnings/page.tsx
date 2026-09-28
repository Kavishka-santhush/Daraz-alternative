'use client';

import { useState } from 'react';
import { Loader2, Wallet, TrendingUp, Coins, Landmark, Banknote } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/status-badge';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useSellerEarnings, useRequestPayout, useSaveBank } from '@/hooks/use-seller';
import { formatMoney, num, formatDate } from '@/lib/utils';

export default function SellerEarningsPage() {
  const { data, isLoading } = useSellerEarnings();
  const payout = useRequestPayout();
  const saveBank = useSaveBank();

  const [payoutOpen, setPayoutOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [bankOpen, setBankOpen] = useState(false);
  const [bank, setBank] = useState({ bankName: '', bankAccountNo: '', bankBranch: '', accountHolder: '' });

  if (isLoading || !data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const s = data.summary;
  const available = num(s.available ?? 0);

  const openBankForm = () => {
    if (data.bank) setBank({ bankName: data.bank.bankName, bankAccountNo: data.bank.bankAccountNo, bankBranch: data.bank.bankBranch ?? '', accountHolder: data.bank.accountHolder });
    setBankOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Earnings &amp; payouts</h1>
          <p className="text-sm text-muted-foreground">Track your net revenue and withdraw to your bank.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openBankForm}>
            <Landmark className="mr-2 h-4 w-4" /> {data.bank ? 'Edit bank' : 'Add bank'}
          </Button>
          <Button
            variant="brand"
            size="sm"
            disabled={available <= 0 || !data.bank}
            onClick={() => {
              setAmount(String(available));
              setPayoutOpen(true);
            }}
          >
            <Banknote className="mr-2 h-4 w-4" /> Request payout
          </Button>
        </div>
      </div>

      {!data.bank && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Add your bank account details before requesting a payout.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Gross revenue" value={formatMoney(num(s.grossRevenue ?? 0))} icon={TrendingUp} />
        <StatCard label="Net earnings" value={formatMoney(num(s.netEarnings ?? 0))} icon={Coins} hint={`Commission paid ${formatMoney(num(s.commissionPaid ?? 0))}`} />
        <StatCard label="Available" value={formatMoney(available)} icon={Wallet} />
        <StatCard label="Pending" value={formatMoney(num(s.pending ?? 0))} icon={Loader2} hint={`Withdrawn ${formatMoney(num(s.withdrawn ?? 0))}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payout history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.payouts.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Banknote} title="No payouts yet" description="Requested payouts and their status will appear here." />
            </div>
          ) : (
            <div className="divide-y">
              {data.payouts.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{formatMoney(num(p.amount))}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.payoutNumber} · {p.bankName} ••••{p.bankAccountNo.slice(-4)} · {formatDate(p.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {p.rejectionReason && <span className="max-w-[220px] truncate text-xs text-destructive">{p.rejectionReason}</span>}
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request payout */}
      <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a payout</DialogTitle>
            <DialogDescription>Available balance: {formatMoney(available)}. Funds usually settle in 2–5 business days.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              max={available}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayoutOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              disabled={payout.isPending || !(Number(amount) > 0) || Number(amount) > available}
              onClick={() => payout.mutate(Number(amount), { onSuccess: () => setPayoutOpen(false) })}
            >
              {payout.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Request {formatMoney(Number(amount) || 0)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bank details */}
      <Dialog open={bankOpen} onOpenChange={setBankOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bank account</DialogTitle>
            <DialogDescription>Where should we send your payouts?</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="bankName">Bank name</Label>
              <Input id="bankName" value={bank.bankName} onChange={(e) => setBank((b) => ({ ...b, bankName: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="accountHolder">Account holder</Label>
              <Input id="accountHolder" value={bank.accountHolder} onChange={(e) => setBank((b) => ({ ...b, accountHolder: e.target.value }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="accountNo">Account number</Label>
                <Input id="accountNo" value={bank.bankAccountNo} onChange={(e) => setBank((b) => ({ ...b, bankAccountNo: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="branch">Branch (optional)</Label>
                <Input id="branch" value={bank.bankBranch} onChange={(e) => setBank((b) => ({ ...b, bankBranch: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBankOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              disabled={saveBank.isPending || !bank.bankName || !bank.bankAccountNo || !bank.accountHolder}
              onClick={() => saveBank.mutate(bank, { onSuccess: () => setBankOpen(false) })}
            >
              {saveBank.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save bank details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
