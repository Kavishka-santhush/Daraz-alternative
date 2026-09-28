'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MapPin, Plus, Pencil, Trash2, Star, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { useAddresses, useAddressMutations, type AddressInput } from '@/hooks/use-account';
import type { Address } from '@/types';

const addressSchema = z.object({
  label: z.string().max(40).optional(),
  contactName: z.string().min(2, 'Enter a name').max(120),
  contactPhone: z.string().min(6, 'Enter a valid phone').max(20),
  line1: z.string().min(3, 'Enter the address').max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1, 'City is required').max(100),
  district: z.string().max(100).optional(),
  province: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  isDefault: z.boolean().optional(),
});
type AddressForm = z.infer<typeof addressSchema>;

/** Map a saved address (or blank) into the form's field shape. */
function toForm(editing: Address | null): AddressForm {
  return {
    label: editing?.label ?? '',
    contactName: editing?.contactName ?? '',
    contactPhone: editing?.contactPhone ?? '',
    line1: editing?.line1 ?? '',
    line2: editing?.line2 ?? '',
    city: editing?.city ?? '',
    district: editing?.district ?? '',
    province: editing?.province ?? '',
    postalCode: editing?.postalCode ?? '',
    isDefault: editing?.isDefault ?? false,
  };
}

function AddressDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Address | null;
}) {
  const muts = useAddressMutations();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
    defaultValues: toForm(editing),
  });

  // Re-seed the form each time the dialog opens (or the edit target changes).
  useEffect(() => {
    if (open) reset(toForm(editing));
  }, [open, editing, reset]);

  const isDefault = watch('isDefault');

  const onSave = handleSubmit((values) => {
    const body: AddressInput = {
      label: values.label || undefined,
      contactName: values.contactName,
      contactPhone: values.contactPhone,
      line1: values.line1,
      line2: values.line2 || undefined,
      city: values.city,
      district: values.district || undefined,
      province: values.province || undefined,
      postalCode: values.postalCode || undefined,
      isDefault: values.isDefault,
    };
    const done = () => {
      reset();
      onOpenChange(false);
    };
    if (editing) muts.update.mutate({ id: editing.id, body }, { onSuccess: done });
    else muts.create.mutate(body, { onSuccess: done });
  });

  const busy = muts.create.isPending || muts.update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit address' : 'Add a new address'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSave} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="label">Label</Label>
              <Input id="label" placeholder="Home, Office…" {...register('label')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contactName">Contact name</Label>
              <Input id="contactName" placeholder="Full name" {...register('contactName')} />
              {errors.contactName && (
                <p className="text-xs text-destructive">{errors.contactName.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="contactPhone">Phone</Label>
              <Input id="contactPhone" placeholder="+94 7X XXX XXXX" {...register('contactPhone')} />
              {errors.contactPhone && (
                <p className="text-xs text-destructive">{errors.contactPhone.message}</p>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="line1">Address line 1</Label>
            <Input id="line1" placeholder="Street address" {...register('line1')} />
            {errors.line1 && <p className="text-xs text-destructive">{errors.line1.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="line2">Address line 2</Label>
            <Input id="line2" placeholder="Apartment, suite (optional)" {...register('line2')} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="city">City</Label>
              <Input id="city" {...register('city')} />
              {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="district">District</Label>
              <Input id="district" {...register('district')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="province">Province / State</Label>
              <Input id="province" {...register('province')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="postalCode">Postal code</Label>
              <Input id="postalCode" {...register('postalCode')} />
            </div>
          </div>
          <label className="flex items-center gap-2 pt-1 text-sm">
            <Checkbox
              checked={Boolean(isDefault)}
              onCheckedChange={(c) => setValue('isDefault', c === true)}
            />
            Set as default shipping address
          </label>
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Save changes' : 'Add address'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AddressesPage() {
  const { data: addresses, isLoading } = useAddresses();
  const muts = useAddressMutations();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (a: Address) => {
    setEditing(a);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">My addresses</h1>
          <p className="text-sm text-muted-foreground">Manage where your orders are shipped.</p>
        </div>
        <Button variant="brand" size="sm" onClick={openNew}>
          <Plus className="h-4 w-4" /> Add address
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : !addresses || addresses.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No saved addresses"
          description="Add a shipping address so checkout is faster next time."
          action={
            <Button variant="brand" onClick={openNew}>
              <Plus className="h-4 w-4" /> Add address
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <Card key={a.id} className={a.isDefault ? 'border-brand/50' : undefined}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-brand" />
                    <span className="font-semibold">{a.label || 'Address'}</span>
                  </div>
                  {a.isDefault && <Badge variant="brand">Default</Badge>}
                </div>
                <div className="text-sm">
                  <p className="font-medium">{a.contactName}</p>
                  <p className="text-muted-foreground">{a.contactPhone}</p>
                  <p className="mt-1 text-muted-foreground">
                    {a.line1}
                    {a.line2 ? `, ${a.line2}` : ''}
                    <br />
                    {a.city}
                    {a.district ? `, ${a.district}` : ''}
                    {a.province ? ` · ${a.province}` : ''}
                    {a.postalCode ? ` ${a.postalCode}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 border-t pt-3">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                  {!a.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={muts.setDefault.isPending}
                      onClick={() => muts.setDefault.mutate(a.id)}
                    >
                      <Star className="h-4 w-4" /> Make default
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-destructive hover:text-destructive"
                    disabled={muts.remove.isPending}
                    onClick={() => muts.remove.mutate(a.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddressDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
    </div>
  );
}
