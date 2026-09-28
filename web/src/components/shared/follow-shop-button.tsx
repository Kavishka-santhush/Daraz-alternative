'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Heart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiPost, ApiClientError } from '@/lib/api';

/** Follow/unfollow a shop; reflects the session gate for guests. */
export function FollowShopButton({ shopId, initialFollowing = false }: { shopId: string; initialFollowing?: boolean }) {
  const { status } = useSession();
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (status !== 'authenticated') {
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setBusy(true);
    try {
      const res = await apiPost<{ following: boolean }>(`/sellers/shops/${shopId}/follow`, {
        follow: !following,
      });
      setFollowing(res.following);
      toast.success(res.following ? 'Following this shop' : 'Unfollowed');
    } catch (e) {
      toast.error('Could not update follow', {
        description: e instanceof ApiClientError ? e.message : 'Please try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant={following ? 'outline' : 'brand'}
      size="sm"
      onClick={toggle}
      disabled={busy}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Heart className={`h-4 w-4 ${following ? 'fill-brand text-brand' : ''}`} />
      )}
      {following ? 'Following' : 'Follow'}
    </Button>
  );
}
