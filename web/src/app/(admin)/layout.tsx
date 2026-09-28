import { AdminShell } from '@/components/shared/admin-shell';

/** Staff console shell — guards access and lays out sidebar + content. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/20">
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
