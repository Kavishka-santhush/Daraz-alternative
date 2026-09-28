'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Loader2, Send, UserPlus, Lock, Unlock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  useTicketDetail, useReplyTicket, useSetTicketStatus, useSetTicketPriority, useAssignTicket,
} from '@/hooks/use-admin';
import { formatDate } from '@/lib/utils';
import type { TicketStatus } from '@/types';

const STATUS_OPTIONS: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export default function AdminTicketDetailPage({ params }: { params: { id: string } }) {
  const { data: session } = useSession();
  const { data: ticket, isLoading } = useTicketDetail(params.id);
  const reply = useReplyTicket();
  const setStatus = useSetTicketStatus();
  const setPriority = useSetTicketPriority();
  const assign = useAssignTicket();

  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [resolution, setResolution] = useState('');

  if (isLoading || !ticket) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const send = () => {
    if (!body.trim()) return;
    reply.mutate({ id: ticket.id, body, internal }, { onSuccess: () => setBody('') });
  };

  const busy = reply.isPending || setStatus.isPending || setPriority.isPending || assign.isPending;

  return (
    <div className="space-y-5">
      <Link href="/admin/support" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Support queue
      </Link>

      <div>
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
          {ticket.subject} <StatusBadge status={ticket.status} />
        </h1>
        <p className="text-sm text-muted-foreground">
          {ticket.ticketNumber} · {ticket.type.replace('_', ' ').toLowerCase()} · opened by {ticket.creator.name} ({ticket.creator.email}) ·{' '}
          {formatDate(ticket.createdAt)}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent className="whitespace-pre-wrap text-sm">{ticket.description}</CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Conversation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {ticket.messages.map((m) => (
                <div key={m.id} className={`rounded-lg border p-3 ${m.isInternal ? 'border-dashed bg-amber-50/60 dark:bg-amber-950/20' : ''}`}>
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold">{m.author?.name ?? 'Unknown'}</span>
                    {m.author && <span className="capitalize text-muted-foreground">{m.author.role.replace('_', ' ').toLowerCase()}</span>}
                    {m.isInternal && <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-medium text-amber-700">Internal note</span>}
                    <span className="ml-auto text-muted-foreground">{formatDate(m.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                  {m.attachments && m.attachments.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {m.attachments.map((a, i) => (
                        <li key={i}>
                          <a href={a} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">
                            Attachment {i + 1}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {ticket.messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-4">
              <Textarea
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={internal ? 'Write an internal note (not visible to customer)…' : 'Write a reply…'}
              />
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setInternal((v) => !v)}
                  className={internal ? 'text-amber-700' : ''}
                >
                  {internal ? <Lock className="mr-1 h-4 w-4" /> : <Unlock className="mr-1 h-4 w-4" />}
                  {internal ? 'Internal note' : 'Public reply'}
                </Button>
                <Button variant="brand" disabled={reply.isPending || !body.trim()} onClick={send}>
                  {reply.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Send
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Manage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <p className="text-muted-foreground">Status</p>
                <Select value={ticket.status} disabled={busy} onValueChange={(v) => setStatus.mutate({ id: ticket.id, status: v as TicketStatus, resolution: resolution.trim() || undefined })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
                <Input
                  placeholder="Resolution note (optional)"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                />
              )}

              <div className="space-y-1.5">
                <p className="text-muted-foreground">Priority</p>
                <Select value={ticket.priority} disabled={busy} onValueChange={(v) => setPriority.mutate({ id: ticket.id, priority: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <p className="text-muted-foreground">Assigned to</p>
                <p className="font-medium">{ticket.assignedTo?.name ?? 'Unassigned'}</p>
                {session?.user?.id && ticket.assignedToId !== session.user.id && (
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => assign.mutate({ id: ticket.id, agentId: session.user.id })}>
                    <UserPlus className="mr-1 h-4 w-4" /> Assign to me
                  </Button>
                )}
              </div>

              {ticket.resolution && (
                <div className="space-y-1">
                  <p className="text-muted-foreground">Resolution</p>
                  <p className="rounded-md bg-muted p-2 text-xs">{ticket.resolution}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
