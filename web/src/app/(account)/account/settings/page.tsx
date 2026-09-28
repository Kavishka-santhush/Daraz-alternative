'use client';

import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signOut } from 'next-auth/react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Camera, Loader2, ShieldCheck, KeyRound, LogOut, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { CopyCodeButton } from '@/components/shared/copy-code-button';
import { useProfile, useUpdateProfile } from '@/hooks/use-account';
import { apiPost, ApiClientError } from '@/lib/api';
import { mediaUrl } from '@/lib/env';
import { initials, formatDate } from '@/lib/utils';

const profileSchema = z.object({
  name: z.string().min(2, 'Enter your name').max(120),
  phone: z
    .string()
    .min(6, 'Enter a valid phone number')
    .max(20)
    .optional()
    .or(z.literal('')),
});
type ProfileForm = z.infer<typeof profileSchema>;

function AvatarUploader({ url, name }: { url?: string | null; name?: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const mut = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('image', file);
      return apiPost<{ avatarUrl: string }>('/users/me/avatar', fd);
    },
    onSuccess: () => toast.success('Profile photo updated'),
    onError: (e: unknown) =>
      toast.error('Upload failed', {
        description: e instanceof ApiClientError ? e.message : 'Please try again.',
      }),
  });

  const pick = (file?: File) => {
    if (!file) return;
    setBusy(true);
    mut.mutate(file, { onSettled: () => setBusy(false) });
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar className="h-16 w-16">
          {url ? <AvatarImage src={mediaUrl(url)} alt={name ?? ''} /> : null}
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label="Change photo"
          className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm hover:text-brand disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>
      <div className="text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Profile photo</p>
        <p>JPG or PNG, up to a few MB.</p>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { data: profile, isLoading } = useProfile();
  const update = useUpdateProfile();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: profile
      ? { name: profile.name, phone: profile.phone ?? '' }
      : undefined,
  });

  const deleteAccount = useMutation({
    mutationFn: () => import('@/lib/api').then((m) => m.apiDelete('/users/me')),
    onSuccess: () => {
      toast.success('Account deleted');
      signOut({ callbackUrl: '/' });
    },
    onError: (e: unknown) =>
      toast.error('Could not delete account', {
        description: e instanceof ApiClientError ? e.message : 'Please contact support.',
      }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const onSave = handleSubmit((values) => {
    update.mutate({
      name: values.name,
      phone: values.phone?.trim() ? values.phone.trim() : undefined,
    });
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile and account preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Profile</CardTitle>
          <CardDescription>Your personal details across MarketPlace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <AvatarUploader url={profile?.avatarUrl} name={profile?.name} />
          <Separator />
          <form onSubmit={onSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" placeholder="+94 7X XXX XXXX" {...register('phone')} />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={profile?.email ?? ''} disabled />
                <p className="text-xs text-muted-foreground">
                  Email can&apos;t be changed here. Contact support if you need to.
                </p>
              </div>
            </div>
            <Button type="submit" variant="brand" disabled={update.isPending}>
              {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Account</CardTitle>
          <CardDescription>Security and referral details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">Email verification</p>
              <p className="text-muted-foreground">Keep your contact details confirmed.</p>
            </div>
            {profile?.emailVerifiedAt ? (
              <Badge variant="success" className="gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Verified
              </Badge>
            ) : (
              <Badge variant="secondary">Not verified</Badge>
            )}
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">Password</p>
              <p className="text-muted-foreground">Reset via a secure email link.</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <a href="/forgot-password">
                <KeyRound className="h-4 w-4" /> Change password
              </a>
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">Your referral code</p>
              <p className="text-muted-foreground">
                Share it — you both get rewarded when a friend joins.
              </p>
            </div>
            {profile?.referralCode && <CopyCodeButton code={profile.referralCode} />}
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">Member since</p>
              <p className="text-muted-foreground">
                {profile?.createdAt ? formatDate(profile.createdAt) : '—'} · Role{' '}
                <span className="capitalize">{profile?.role?.toLowerCase().replace(/_/g, ' ')}</span>
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: '/' })}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4" /> Danger zone
          </CardTitle>
          <CardDescription>
            Permanently delete your account and personal data. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <LogOut className="h-4 w-4" /> Delete my account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete account?</DialogTitle>
                <DialogDescription>
                  This will permanently remove your profile, addresses and preferences. Ongoing
                  orders may still need to be handled with support.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={deleteAccount.isPending}
                  onClick={() => deleteAccount.mutate()}
                >
                  {deleteAccount.isPending ? 'Deleting…' : 'Yes, delete my account'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
