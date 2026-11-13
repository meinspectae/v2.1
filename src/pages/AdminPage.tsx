import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { client } from '../api/client';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  phone: string;
  location: string;
  isTester: number;
  freeInspections: number;
  totalInspections: number;
  createdAt: string;
}

type AccessState = 'checking' | 'allowed' | 'denied';

export default function AdminPage() {
  const [access, setAccess] = useState<AccessState>('checking');
  const [searchQ, setSearchQ] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [grantEmail, setGrantEmail] = useState('');
  const [grantCount, setGrantCount] = useState(1);
  const [grantLoading, setGrantLoading] = useState(false);
  const [grantMsg, setGrantMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchUsers = useCallback(async (q = '') => {
    setUsersLoading(true);
    setUsersError('');
    try {
      const response = await client.api.fetch(`/api/admin/users?q=${encodeURIComponent(q)}`);
      if (response.status === 403) {
        setAccess('denied');
        return;
      }
      if (!response.ok) throw new Error(`Users could not be loaded (${response.status}).`);
      const data = await response.json();
      setUsers(data.data || []);
    } catch (error) {
      setUsersError(error instanceof Error ? error.message : 'Users could not be loaded.');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    client.api.fetch('/api/admin/access').then(async response => {
      if (cancelled) return;
      if (!response.ok) {
        setAccess('denied');
        return;
      }
      setAccess('allowed');
      await fetchUsers();
    }).catch(() => {
      if (!cancelled) setAccess('denied');
    });
    return () => { cancelled = true; };
  }, [fetchUsers]);

  const handleGrant = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!grantEmail.trim()) return;
    setGrantLoading(true);
    setGrantMsg(null);
    try {
      const response = await client.api.fetch('/api/admin/grant-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: grantEmail.trim(), count: grantCount }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 403) {
        setAccess('denied');
        return;
      }
      if (!response.ok) throw new Error(data.error || 'Credits could not be granted.');
      setGrantMsg({ type: 'success', text: data.message });
      setGrantEmail('');
      setGrantCount(1);
      await fetchUsers(searchQ);
    } catch (error) {
      setGrantMsg({ type: 'error', text: error instanceof Error ? error.message : 'Credits could not be granted.' });
    } finally {
      setGrantLoading(false);
    }
  };

  if (access === 'denied') return <Navigate to="/" replace />;
  if (access === 'checking') {
    return <main className="flex min-h-screen items-center justify-center bg-slate-900 text-sm font-medium text-slate-300">Checking admin access…</main>;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-700 bg-slate-800 px-4 py-4">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-sm font-bold">MeInspect Admin</h1>
          <p className="text-xs text-slate-400">Credit Management</p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <section className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
          <h2 className="mb-1 text-sm font-semibold">Grant Free Inspections</h2>
          <p className="mb-4 text-xs text-slate-400">Credits are used automatically before charging Stripe.</p>
          <form onSubmit={handleGrant} className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label htmlFor="admin-grant-email" className="mb-1 block text-xs text-slate-400">User Email</label>
                <input id="admin-grant-email" type="email" value={grantEmail} onChange={event => setGrantEmail(event.target.value)} placeholder="user@example.com" className="w-full rounded-xl border border-slate-600 bg-slate-700 px-3 py-2.5 text-sm text-white" />
              </div>
              <div className="w-24">
                <label htmlFor="admin-grant-credits" className="mb-1 block text-xs text-slate-400">Credits</label>
                <input id="admin-grant-credits" type="number" min={1} max={100} value={grantCount} onChange={event => setGrantCount(Number.parseInt(event.target.value, 10) || 1)} className="w-full rounded-xl border border-slate-600 bg-slate-700 px-3 py-2.5 text-sm text-white" />
              </div>
            </div>
            {grantMsg && <p className={`rounded-lg px-3 py-2 text-sm ${grantMsg.type === 'success' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>{grantMsg.text}</p>}
            <button type="submit" disabled={grantLoading || !grantEmail.trim()} className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold disabled:opacity-40">{grantLoading ? 'Granting…' : `Grant ${grantCount} Credit${grantCount === 1 ? '' : 's'}`}</button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-sm font-semibold">Users</h2><p className="text-xs text-slate-400">{users.length} result{users.length === 1 ? '' : 's'}</p></div>
            <form onSubmit={event => { event.preventDefault(); void fetchUsers(searchQ); }} className="flex gap-2">
              <input aria-label="Search users by email or name" value={searchQ} onChange={event => setSearchQ(event.target.value)} placeholder="Search users…" className="w-52 rounded-xl border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white" />
              <button type="submit" className="rounded-xl bg-slate-600 px-3 py-2 text-sm font-medium">Search</button>
            </form>
          </div>
          {usersError && <p className="mb-3 text-sm text-red-400">{usersError}</p>}
          {usersLoading ? <p className="py-8 text-center text-sm text-slate-400">Loading users…</p> : (
            <div className="space-y-2">
              {users.map(user => (
                <div key={user.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-600/50 bg-slate-700/50 px-4 py-3">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user.name || '(no name)'}</p><p className="truncate text-xs text-slate-400">{user.email}</p></div>
                  <span className="text-xs text-slate-300">Reports {user.totalInspections}</span>
                  <span className="text-xs text-slate-300">Credits {user.freeInspections}</span>
                  {user.isTester === 1 && <span className="rounded-full bg-yellow-900/40 px-2 py-0.5 text-xs text-yellow-400">Tester</span>}
                  <button onClick={() => { setGrantEmail(user.email); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="rounded-lg border border-blue-500/30 bg-blue-600/20 px-3 py-1.5 text-xs font-medium text-blue-400">+ Credit</button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
