import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';

const TABS = [
  { label: 'Dashboard', soon: true },
  { label: 'Products', href: '/admin' },
  { label: 'Inventory', href: '/admin/inventory' },
  { label: 'Orders', soon: true },
  { label: 'Customers', soon: true },
  { label: 'Settings', href: '/admin/settings' },
];

// Shared header, navigation and admin check for every /admin page.
export default function AdminLayout({ children }) {
  const router = useRouter();
  const { user, isAdmin, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(router.asPath)}`);
  }, [loading, user, router]);

  let body = children;
  if (loading || !user) body = <p className="text-stone-600">Loading…</p>;
  else if (!isAdmin) {
    body = (
      <div className="max-w-md mx-auto bg-white rounded-xl border border-stone-200 p-6 text-center space-y-3">
        <p className="font-bold text-stone-900">You do not have admin access.</p>
        <button type="button" onClick={async () => { await signOut(); router.replace('/'); }} className="font-bold underline">
          Log out
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F4EF] text-[#1F1A14]">
      <header className="bg-[#1F1A14] text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-x-7 gap-y-2">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tracking-wide text-[#F7D417]">FOJEC</span>
            <span className="text-xs text-stone-300">Admin</span>
          </Link>
          <nav aria-label="Admin sections" className="flex flex-wrap gap-1 flex-1">
            {TABS.map((t) => {
              if (t.soon) return <span key={t.label} className="px-3 py-2 text-stone-400">{t.label} · soon</span>;
              const active = router.pathname === t.href;
              return (
                <Link
                  key={t.label}
                  href={t.href}
                  aria-current={active ? 'page' : undefined}
                  className={`px-3 py-2 rounded-lg ${active ? 'bg-[#F7D417] text-[#1F1A14] font-semibold' : 'text-white hover:bg-white/10'}`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
          {user && (
            <button type="button" onClick={async () => { await signOut(); router.replace('/'); }} className="text-sm text-stone-300 hover:text-white">
              Log out
            </button>
          )}
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">{body}</main>
    </div>
  );
}
