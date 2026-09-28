'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { LifeBuoy, Plus, Loader2, MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { useMyTickets, useCreateTicket } from '@/hooks/use-account';
import { formatDate } from '@/lib/utils';

const ticketSchema = z.object({
  type: z.enum(['ORDER', 'RETURN', 'REFUND', 'PRODUCT', 'PAYMENT', 'ACCOUNT', 'OTHER']),
  subject: z.string().min(4, 'Give a short subject').max(160),
  description: z.string().min(10, 'Please add more detail').max(4000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});
type TicketForm = z.infer<typeof ticketSchema>;

const TYPES: Array<{ value: TicketForm['type']; label: string }> = [
  { value: 'ORDER', label: 'Order issue' },
  { value: 'RETURN', label: 'Return / refund' },
  { value: 'REFUND', label: 'Refund' },
  { value: 'PRODUCT', label: 'Product question' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'ACCOUNT', label: 'Account' },
  { value: 'OTHER', label: 'Something else' },
];

function NewTicketDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const create = useCreateTicket();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TicketForm>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { type: 'ORDER', priority: 'MEDIUM' },
  });

  useEffect(() => {
    if (open) reset({ type: 'ORDER', priority: 'MEDIUM' });
  }, [open, reset]);

  const type = watch('type');
  const priority = watch('priority');

  const onSubmit = handleSubmit((values) => {
    create.mutate(
      {
        type: values.type,
        subject: values.subject,
        description: values.description,
        priority: values.priority,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Open a support ticket</DialogTitle>
          <DialogDescription>
            Tell us what happened and our team will get back to you by email.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Topic</Label>
              <Select value={type} onValueChange={(v) => setValue('type', v as TicketForm['type'])}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a topic" />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select
                value={priority ?? 'MEDIUM'}
                onValueChange={(v) => setValue('priority', v as TicketForm['priority'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" placeholder="Brief summary" {...register('subject')} />
            {errors.subject && <p className="text-xs text-destructive">{errors.subject.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={5}
              placeholder="Include order numbers and any detail that helps…"
              {...register('description')}
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit ticket
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SupportPage() {
  const { data, isLoading } = useMyTickets(1);
  const [open, setOpen] = useState(false);
  const items = data?.items ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Help &amp; support</h1>
          <p className="text-sm text-muted-foreground">
            Track your tickets or reach our support team.
          </p>
        </div>
        <Button variant="brand" size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New ticket
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="No tickets yet"
          description="Need a hand? Open a ticket and our team will respond shortly."
          action={
            <div className="flex gap-2">
              <Button variant="brand" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> New ticket
              </Button>
              <Button asChild variant="outline">
                <Link href="/help">Browse help centre</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 shrink-0 text-brand" />
                    <p className="truncate font-medium">{t.subject}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.ticketNumber} · {t.type} · {formatDate(t.createdAt)}
                  </p>
                </div>
                <StatusBadge status={t.priority} className="capitalize" />
                <StatusBadge status={t.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NewTicketDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
