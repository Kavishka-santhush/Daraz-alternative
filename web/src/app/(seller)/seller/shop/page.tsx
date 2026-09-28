'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, Store, ExternalLink, Boxes } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useSellerShops, useCreateShop, useUpdateShop } from '@/hooks/use-seller';
import { mediaUrl } from '@/lib/env';
import type { SellerShop } from '@/types';

interface EditState {
  name: string;
  description: string;
  shippingOrigin: string;
  defaultDeliveryDays: string;
  policyReturn: string;
  policyShipping: string;
  policyWarranty: string;
  isActive: boolean;
}

function toEdit(s: SellerShop): EditState {
  return {
    name: s.name,
    description: s.description ?? '',
    shippingOrigin: s.shippingOrigin ?? '',
    defaultDeliveryDays: String(s.defaultDeliveryDays ?? 3),
    policyReturn: s.policyReturn ?? '',
    policyShipping: s.policyShipping ?? '',
    policyWarranty: s.policyWarranty ?? '',
    isActive: s.isActive,
  };
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export default function SellerShopPage() {
  const { data: shops, isLoading } = useSellerShops();
  const create = useCreateShop();
  const update = useUpdateShop();

  const [newOpen, setNewOpen] = useState(false);
  const [newShop, setNewShop] = useState({ name: '', description: '' });
  const [editTarget, setEditTarget] = useState<SellerShop | null>(null);
  const [form, setForm] = useState<EditState | null>(null);

  const openEdit = (s: SellerShop) => {
    setEditTarget(s);
    setForm(toEdit(s));
  };

  const saveEdit = () => {
    if (!editTarget || !form) return;
    update.mutate(
      {
        shopId: editTarget.id,
        body: {
          name: form.name,
          description: form.description,
          shippingOrigin: form.shippingOrigin,
          defaultDeliveryDays: Number(form.defaultDeliveryDays) || 0,
          policyReturn: form.policyReturn,
          policyShipping: form.policyShipping,
          policyWarranty: form.policyWarranty,
          isActive: form.isActive,
        },
      },
      { onSuccess: () => setEditTarget(null) },
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My shop</h1>
          <p className="text-sm text-muted-foreground">Manage your storefront profile and policies.</p>
        </div>
        <Button variant="brand" size="sm" onClick={() => setNewOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New shop
        </Button>
      </div>

      {!shops || shops.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No shop yet"
          description="Create your shop to start listing products. Sellers must be approved first."
          action={
            <Button variant="brand" onClick={() => setNewOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create shop
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shops.map((s) => (
            <Card key={s.id}>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-muted">
                    {s.logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrl(s.logoUrl)} alt={s.name} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{s.name}</p>
                    <p className="truncate text-xs text-muted-foreground">/{s.slug}</p>
                  </div>
                </div>
                {s.description && <p className="line-clamp-2 text-sm text-muted-foreground">{s.description}</p>}
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Boxes className="h-4 w-4" /> {s._count?.products ?? 0} products
                  </span>
                  <span>{s.defaultDeliveryDays}-day delivery</span>
                  <span className={s.isActive ? 'text-green-600' : 'text-muted-foreground'}>
                    {s.isActive ? 'Active' : 'Hidden'}
                  </span>
                </div>
                <div className="flex gap-2 border-t pt-3">
                  <Button variant="outline" size="sm" onClick={() => openEdit(s)}>
                    Edit details
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/shops/${s.slug}`}>
                      <ExternalLink className="mr-1 h-4 w-4" /> View
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create shop */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a shop</DialogTitle>
            <DialogDescription>Give your storefront a name and short description.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field id="ns-name" label="Shop name">
              <Input id="ns-name" value={newShop.name} onChange={(e) => setNewShop((v) => ({ ...v, name: e.target.value }))} />
            </Field>
            <Field id="ns-desc" label="Description (optional)">
              <Textarea id="ns-desc" rows={3} value={newShop.description} onChange={(e) => setNewShop((v) => ({ ...v, description: e.target.value }))} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              disabled={create.isPending || !newShop.name.trim()}
              onClick={() =>
                create.mutate(
                  { name: newShop.name, description: newShop.description || undefined },
                  {
                    onSuccess: () => {
                      setNewShop({ name: '', description: '' });
                      setNewOpen(false);
                    },
                  },
                )
              }
            >
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create shop
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit shop */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit shop</DialogTitle>
            <DialogDescription>Update your storefront details and buyer policies.</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-3">
              <Field id="e-name" label="Shop name">
                <Input id="e-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f!, name: e.target.value }))} />
              </Field>
              <Field id="e-desc" label="Description">
                <Textarea id="e-desc" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f!, description: e.target.value }))} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="e-origin" label="Shipping origin">
                  <Input id="e-origin" value={form.shippingOrigin} onChange={(e) => setForm((f) => ({ ...f!, shippingOrigin: e.target.value }))} />
                </Field>
                <Field id="e-days" label="Default delivery days">
                  <Input
                    id="e-days"
                    type="number"
                    min="0"
                    value={form.defaultDeliveryDays}
                    onChange={(e) => setForm((f) => ({ ...f!, defaultDeliveryDays: e.target.value.replace(/[^0-9]/g, '') }))}
                  />
                </Field>
              </div>
              <Field id="e-ret" label="Return policy">
                <Textarea id="e-ret" rows={2} value={form.policyReturn} onChange={(e) => setForm((f) => ({ ...f!, policyReturn: e.target.value }))} />
              </Field>
              <Field id="e-ship" label="Shipping policy">
                <Textarea id="e-ship" rows={2} value={form.policyShipping} onChange={(e) => setForm((f) => ({ ...f!, policyShipping: e.target.value }))} />
              </Field>
              <Field id="e-warr" label="Warranty policy">
                <Textarea id="e-warr" rows={2} value={form.policyWarranty} onChange={(e) => setForm((f) => ({ ...f!, policyWarranty: e.target.value }))} />
              </Field>
              <label className="flex items-center gap-3 text-sm">
                <Checkbox checked={form.isActive} onCheckedChange={(c) => setForm((f) => ({ ...f!, isActive: c === true }))} />
                Shop is visible to buyers
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button variant="brand" disabled={update.isPending || !form?.name.trim()} onClick={saveEdit}>
              {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
