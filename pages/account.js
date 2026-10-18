import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import PageFrame from '../components/PageFrame';
import { useAuth } from '../lib/AuthContext';

export default function AccountPage() {
  const router = useRouter();
  const { user, profile, isAdmin, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=/account');
  }, [loading, user, router]);

  if (loading || !user) {
    return <PageFrame title="Account"><p className="text-gray-500">Loading…</p></PageFrame>;
  }

  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || user.email;

  return (
    <PageFrame title="My account">
      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <div>
          <p className="text-sm text-gray-500">Signed in as</p>
          <p className="text-xl font-bold text-gray-900">{name}</p>
          <p className="text-sm text-gray-600">{user.email}</p>
          {profile?.phone && <p className="text-sm text-gray-600">{profile.phone}</p>}
        </div>
        {isAdmin && (
          <Link href="/admin" className="block text-center w-full py-3 rounded-lg bg-green-700 hover:bg-green-800 text-white font-bold">
            Go to admin dashboard
          </Link>
        )}
        <Link href="/" className="block text-center w-full py-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold">
          Continue shopping
        </Link>
        <button
          type="button"
          onClick={async () => { await signOut(); router.replace('/'); }}
          className="w-full py-3 rounded-lg border border-gray-300 text-gray-700 font-bold hover:bg-gray-50"
        >
          Log out
        </button>
      </div>
    </PageFrame>
  );
}
