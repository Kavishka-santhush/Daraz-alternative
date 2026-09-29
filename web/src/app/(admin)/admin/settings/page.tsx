'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSession } from 'next-auth/react';
import { Loader2, ShieldAlert, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminSettings, useUpdateSettings } from '@/hooks/use-admin';
import { num } from '@/lib/utils';
import type { AdminSettings, AdminSettingsInput } from '@/types';

const schema = z.object({
  platformName: z.string().min(2).max(80),
  platformLogoUrl: z.string().max(400).optional(),
  currency: z.string().length(3),
  currencySymbol: z.string().min(1).max(4),
  locale: z.string().max(10).optional(),
  defaultCommissionPercent: z.coerce.number().min(0).max(100),
  returnWindowDays: z.coerce.number().int().min(0).max(120),
  codEnabled: z.boolean(),
  codMaxAmount: z.coerce.number().min(0),
  installmentsEnabled: z.boolean(),
  minPayoutAmount: z.coerce.number().min(0),
  freeShippingThreshold: z.coerce.number().min(0),
  flatShippingFee: z.coerce.number().min(0),
  taxPercent: z.coerce.number().min(0).max(100),
  aiEnabled: z.boolean(),
  maintenanceMode: z.boolean(),
  supportEmail: z.string().email(),
});

type FormValues = z.input<typeof schema>;

const SETTINGS_ROLES = ['SUPER_ADMIN', 'ADMIN'];

function toForm(s: AdminSettings): FormValues {
  return {
    platformName: s.platformName,
    platformLogoUrl: s.platformLogoUrl ?? '',
    currency: s.currency,
    currencySymbol: s.currencySymbol,
    locale: s.locale ?? '',
    defaultCommissionPercent: num(s.defaultCommissionPercent),
    returnWindowDays: s.returnWindowDays,
    codEnabled: s.codEnabled,
    codMaxAmount: s.codMaxAmount ? num(s.codMaxAmount) : 0,
    installmentsEnabled: s.installmentsEnabled,
    minPayoutAmount: num(s.minPayoutAmount),
    freeShippingThreshold: num(s.freeShippingThreshold),
    flatShippingFee: num(s.flatShippingFee),
    taxPercent: num(s.taxPercent),
    aiEnabled: s.aiEnabled,
    maintenanceMode: s.maintenanceMode,
    supportEmail: s.supportEmail,
  };
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function Toggle({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
      </span>
    </label>
  );
}

function SettingsForm() {
  const { data, isLoading } = useAdminSettings();
  const update = useUpdateSettings();
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: undefined,
  });

  useEffect(() => {
    if (data) reset(toForm(data));
  }, [data, reset]);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const onSubmit = (values: FormValues) => update.mutate(values as AdminSettingsInput);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Platform settings</h1>
          <p className="text-sm text-muted-foreground">Global commerce, payment and branding configuration.</p>
        </div>
        <Button type="submit" variant="brand" disabled={update.isPending}>
          {update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save changes
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Branding & localisation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Platform name" htmlFor="platformName">
            <Input id="platformName" {...register('platformName')} />
            {errors.platformName && <p className="text-xs text-destructive">{errors.platformName.message}</p>}
          </Field>
          <Field label="Logo URL" htmlFor="platformLogoUrl">
            <Input id="platformLogoUrl" {...register('platformLogoUrl')} placeholder="https://…" />
          </Field>
          <Field label="Currency code" htmlFor="currency">
            <Input id="currency" maxLength={3} {...register('currency')} />
            {errors.currency && <p className="text-xs text-destructive">{errors.currency.message}</p>}
          </Field>
          <Field label="Currency symbol" htmlFor="currencySymbol">
            <Input id="currencySymbol" {...register('currencySymbol')} />
          </Field>
          <Field label="Locale" htmlFor="locale">
            <Input id="locale" {...register('locale')} placeholder="en-US" />
          </Field>
          <Field label="Support email" htmlFor="supportEmail">
            <Input id="supportEmail" type="email" {...register('supportEmail')} />
            {errors.supportEmail && <p className="text-xs text-destructive">{errors.supportEmail.message}</p>}
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Commerce & payments</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Default commission %" htmlFor="defaultCommissionPercent">
            <Input id="defaultCommissionPercent" type="number" step="0.01" {...register('defaultCommissionPercent')} />
          </Field>
          <Field label="Tax %" htmlFor="taxPercent">
            <Input id="taxPercent" type="number" step="0.01" {...register('taxPercent')} />
          </Field>
          <Field label="Return window (days)" htmlFor="returnWindowDays">
            <Input id="returnWindowDays" type="number" {...register('returnWindowDays')} />
          </Field>
          <Field label="Min payout amount" htmlFor="minPayoutAmount">
            <Input id="minPayoutAmount" type="number" step="0.01" {...register('minPayoutAmount')} />
          </Field>
          <Field label="Free shipping threshold" htmlFor="freeShippingThreshold">
            <Input id="freeShippingThreshold" type="number" step="0.01" {...register('freeShippingThreshold')} />
          </Field>
          <Field label="Flat shipping fee" htmlFor="flatShippingFee">
            <Input id="flatShippingFee" type="number" step="0.01" {...register('flatShippingFee')} />
          </Field>
          <Field label="COD max amount" htmlFor="codMaxAmount">
            <Input id="codMaxAmount" type="number" step="0.01" {...register('codMaxAmount')} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feature toggles</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Controller
            control={control}
            name="codEnabled"
            render={({ field }) => (
              <Toggle label="Cash on delivery" description="Allow buyers to pay on delivery" checked={field.value} onChange={field.onChange} />
            )}
          />
          <Controller
            control={control}
            name="installmentsEnabled"
            render={({ field }) => (
              <Toggle label="Installments" description="Enable EMI payment plans" checked={field.value} onChange={field.onChange} />
            )}
          />
          <Controller
            control={control}
            name="aiEnabled"
            render={({ field }) => (
              <Toggle label="AI features" description="Recommendations and AI assistant" checked={field.value} onChange={field.onChange} />
            )}
          />
          <Controller
            control={control}
            name="maintenanceMode"
            render={({ field }) => (
              <Toggle label="Maintenance mode" description="Lock the storefront for non-staff" checked={field.value} onChange={field.onChange} />
            )}
          />
        </CardContent>
      </Card>
    </form>
  );
}

export default function AdminSettingsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const allowed = !!role && SETTINGS_ROLES.includes(role);

  if (!allowed) {
    return (
      <div className="flex flex-col items-center gap-2 py-24 text-center">
        <ShieldAlert className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Only administrators can manage platform settings.</p>
      </div>
    );
  }

  return <SettingsForm />;
}
