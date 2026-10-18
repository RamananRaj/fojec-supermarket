import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import PageFrame from '../components/PageFrame';
import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

const blank = { firstName: '', lastName: '', phone: '', email: '', password: '', confirm: '' };

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const next = typeof router.query.next === 'string' ? router.query.next : '/account';

  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, next, router]);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!supabaseConfigured) {
      setError('The website is not connected to the database yet.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: form.email.trim(),
          password: form.password,
        });
        if (err) throw err;
        router.replace(next);
      } else {
        if (form.password !== form.confirm) throw new Error('Passwords do not match.');
        if (form.password.length < 8) throw new Error('Password must be at least 8 characters.');
        const { data, error: err } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: {
            data: {
              first_name: form.firstName.trim(),
              last_name: form.lastName.trim(),
              phone: form.phone.trim(),
            },
          },
        });
        if (err) throw err;
        if (data.session) {
          router.replace(next);
        } else {
          setNotice('Account created. Check your email and click the confirmation link, then log in.');
          setMode('login');
          setForm({ ...blank, email: form.email });
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600';

  return (
    <PageFrame title={mode === 'login' ? 'Log in' : 'Create account'}>
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
          {['login', 'register'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null); setNotice(null); }}
              className={`flex-1 py-2 rounded-md font-bold text-sm transition ${
                mode === m ? 'bg-white text-green-700 shadow' : 'text-gray-600'
              }`}
            >
              {m === 'login' ? 'Log in' : 'Sign up'}
            </button>
          ))}
        </div>

        {notice && <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">{notice}</div>}
        {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          {mode === 'register' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <input className={input} name="firstName" placeholder="First name" value={form.firstName} onChange={update} required />
                <input className={input} name="lastName" placeholder="Last name" value={form.lastName} onChange={update} required />
              </div>
              <input className={input} name="phone" type="tel" placeholder="Mobile (0412 345 678)" value={form.phone} onChange={update} />
            </>
          )}
          <input className={input} name="email" type="email" placeholder="Email" value={form.email} onChange={update} required autoComplete="email" />
          <input className={input} name="password" type="password" placeholder="Password" value={form.password} onChange={update} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          {mode === 'register' && (
            <input className={input} name="confirm" type="password" placeholder="Confirm password" value={form.confirm} onChange={update} required autoComplete="new-password" />
          )}
          <button type="submit" disabled={busy} className="w-full py-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold disabled:opacity-50">
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
      </div>
    </PageFrame>
  );
}
