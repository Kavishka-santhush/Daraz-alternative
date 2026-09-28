'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SocialAuthButtons } from '@/components/shared/social-auth-buttons';
import { apiPost, ApiClientError } from '@/lib/api';

/* Mirrors server/src/modules/auth/auth.schema.ts (buyer + seller register). */

const buyerSchema = z.object({
  name: z.string().min(2, 'At least 2 characters').max(80),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'At least 8 characters').max(128),
  phone: z.string().min(7, 'Enter a valid phone number').max(20).optional().or(z.literal('')),
  referralCode: z.string().max(20).optional().or(z.literal('')),
});

const sellerSchema = buyerSchema
  .omit({ referralCode: true })
  .extend({
    phone: z.string().min(7, 'Phone is required for sellers').max(20),
    shopName: z.string().min(2, 'Shop name is required').max(80),
    shopDescription: z.string().max(1000).optional().or(z.literal('')),
  });

type BuyerForm = z.infer<typeof buyerSchema>;
type SellerForm = z.infer<typeof sellerSchema>;

function fieldError(errors: Record<string, { message?: string } | undefined>, key: string) {
  const msg = errors[key]?.message;
  return msg ? <p className="text-xs text-destructive">{msg}</p> : null;
}

function isSafeCallbackUrl(url: string | null | undefined): url is string {
  return Boolean(url && url.startsWith('/') && !url.startsWith('//'));
}

/** Register, then immediately sign in with the same credentials. */
async function registerAndSignIn(
  path: '/auth/register/buyer' | '/auth/register/seller',
  values: Record<string, unknown>,
  email: string,
  password: string,
  callbackUrl: string,
) {
  const { referralCode, shopDescription, ...rest } = values;
  const payload = {
    ...rest,
    ...(referralCode ? { referralCode } : {}),
    ...(shopDescription ? { shopDescription } : {}),
  };
  await apiPost<{ user: { id: string } }>(path, payload, { token: null });
  const res = await signIn('credentials', { redirect: false, email, password });
  if (res?.error || !res?.ok) {
    toast.success('Account created!', {
      description: 'Auto sign-in failed — please sign in manually.',
    });
    window.location.assign('/login');
    return;
  }
  toast.success('Account created — welcome aboard!');
  window.location.replace(callbackUrl);
}

function BuyerFormTab() {
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl');
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BuyerForm>({
    resolver: zodResolver(buyerSchema),
    defaultValues: { name: '', email: '', password: '', phone: '', referralCode: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      await registerAndSignIn(
        '/auth/register/buyer',
        values as unknown as Record<string, unknown>,
        values.email,
        values.password,
        isSafeCallbackUrl(callbackUrl) ? callbackUrl : '/account',
      );
    } catch (e) {
      toast.error('Registration failed', {
        description:
          e instanceof ApiClientError ? e.message : 'Something went wrong. Please try again.',
      });
      setSubmitting(false);
    }
  });

  const errs = errors as Record<string, { message?: string } | undefined>;

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="b-name">Full name</Label>
        <Input id="b-name" autoComplete="name" placeholder="Jane Doe" {...register('name')} />
        {fieldError(errs, 'name')}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="b-email">Email</Label>
        <Input id="b-email" type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} />
        {fieldError(errs, 'email')}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="b-password">Password</Label>
          <Input id="b-password" type="password" autoComplete="new-password" placeholder="Min. 8 characters" {...register('password')} />
          {fieldError(errs, 'password')}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="b-phone">Phone (optional)</Label>
          <Input id="b-phone" autoComplete="tel" placeholder="+94 7X XXX XXXX" {...register('phone')} />
          {fieldError(errs, 'phone')}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="b-referral">Referral code (optional)</Label>
        <Input id="b-referral" placeholder="e.g. SAVE10ABC" {...register('referralCode')} />
        {fieldError(errs, 'referralCode')}
      </div>
      <Button type="submit" variant="brand" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Create buyer account
      </Button>
    </form>
  );
}

function SellerFormTab() {
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl');
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SellerForm>({
    resolver: zodResolver(sellerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      phone: '',
      shopName: '',
      shopDescription: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      await registerAndSignIn(
        '/auth/register/seller',
        values as unknown as Record<string, unknown>,
        values.email,
        values.password,
        isSafeCallbackUrl(callbackUrl) ? callbackUrl : '/seller',
      );
    } catch (e) {
      toast.error('Registration failed', {
        description:
          e instanceof ApiClientError ? e.message : 'Something went wrong. Please try again.',
      });
      setSubmitting(false);
    }
  });

  const errs = errors as Record<string, { message?: string } | undefined>;

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="s-name">Your name</Label>
        <Input id="s-name" autoComplete="name" placeholder="Jane Doe" {...register('name')} />
        {fieldError(errs, 'name')}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="s-email">Email</Label>
          <Input id="s-email" type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} />
          {fieldError(errs, 'email')}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-phone">Phone</Label>
          <Input id="s-phone" autoComplete="tel" placeholder="+94 7X XXX XXXX" {...register('phone')} />
          {fieldError(errs, 'phone')}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-password">Password</Label>
        <Input id="s-password" type="password" autoComplete="new-password" placeholder="Min. 8 characters" {...register('password')} />
        {fieldError(errs, 'password')}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-shop">Shop name</Label>
        <Input id="s-shop" placeholder="Jane&apos;s Treasures" {...register('shopName')} />
        {fieldError(errs, 'shopName')}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-shopdesc">Shop description (optional)</Label>
        <Textarea
          id="s-shopdesc"
          rows={3}
          placeholder="What will you sell? Tell buyers about your store."
          {...register('shopDescription')}
        />
        {fieldError(errs, 'shopDescription')}
      </div>
      <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        Seller accounts are reviewed by our team before your shop goes live. You can add products
        right after registering.
      </p>
      <Button type="submit" variant="brand" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Create seller account
      </Button>
    </form>
  );
}

function RegisterForms() {
  const params = useSearchParams();
  // /sell links here with ?tab=seller — fall back to the buyer tab.
  const defaultTab = params.get('tab') === 'seller' ? 'seller' : 'buyer';
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Create an account</CardTitle>
        <CardDescription>Shop as a buyer or open your own store as a seller.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue={defaultTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="buyer">Buy</TabsTrigger>
            <TabsTrigger value="seller">Sell</TabsTrigger>
          </TabsList>
          <TabsContent value="buyer" className="mt-4">
            <BuyerFormTab />
          </TabsContent>
          <TabsContent value="seller" className="mt-4">
            <SellerFormTab />
          </TabsContent>
        </Tabs>

        <SocialAuthButtons />
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForms />
    </Suspense>
  );
}
