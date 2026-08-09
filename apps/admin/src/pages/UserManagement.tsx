import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { adminApi } from '../services/apiClient';
import { displayName, type UserProfile, type UserRole } from '../types';
import { ShieldCheck, UserPlus, Key, UserX, UserCheck, Loader2 } from 'lucide-react';

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Create User Modal Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('CATALOG_MANAGER');
  const [newPassword, setNewPassword] = useState('');

  // Password Reset Modal State
  const [resetModalUser, setResetModalUser] = useState<UserProfile | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState('');

  const loadStaff = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setUsers(await adminApi.getStaff());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load staff accounts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      const created = await adminApi.createStaff({
        email: newEmail.trim(),
        name: newName.trim(),
        password: newPassword,
        role: newRole,
      });
      setUsers((prev) => [created, ...prev]);
      setIsModalOpen(false);
      setNewEmail('');
      setNewName('');
      setNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the account');
    } finally {
      setIsSaving(false);
    }
  };

  // The API enforces this too — it refuses to deactivate your own account or
  // the last active Super Admin.
  const toggleUserActiveStatus = async (targetUser: UserProfile) => {
    setError('');
    try {
      const updated = await adminApi.updateStaff(targetUser.id, { isActive: !targetUser.isActive });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the account');
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser) return;

    setIsSaving(true);
    setError('');
    try {
      await adminApi.resetStaffPassword(resetModalUser.id, resetPasswordInput);
      setResetModalUser(null);
      setResetPasswordInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset the password');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-[#2A2A2A]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-6 w-6 text-[#064e3b]" />
            <h1 className="text-xl font-serif font-bold text-[#2A2A2A]">Super Admin Credential Control & Staff Directory</h1>
          </div>
          <p className="text-xs text-[#6b6661]">
            Centralized management for employee accounts, password resets, and role permissions.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs rounded-xl shadow-sm transition-all"
        >
          <UserPlus className="h-4 w-4" /> Create Staff Account
        </button>
      </div>

      {error && (
        <div className="p-3.5 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium">
          {error}
        </div>
      )}

      {/* Directory Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-xs text-[#6b6661] font-medium">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading staff accounts…
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-xs text-[#6b6661] font-medium">
            No staff accounts yet.
          </div>
        ) : (
        <table className="w-full text-left text-xs text-[#2A2A2A]">
          <thead className="bg-[#FAF8F3] text-[#6b6661] font-bold border-b border-stone-200 uppercase tracking-wider">
            <tr>
              <th className="px-5 py-4">Staff Member</th>
              <th className="px-5 py-4">Email Address</th>
              <th className="px-5 py-4">Role Scope</th>
              <th className="px-5 py-4">Account Status</th>
              <th className="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 font-medium">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-[#FAF8F3]/60 transition-colors">
                <td className="px-5 py-4">
                  <div className="font-bold text-[#2A2A2A]">{displayName(u)}</div>
                  <div className="text-[10px] text-[#6b6661] font-mono">{u.id}</div>
                </td>
                <td className="px-5 py-4 font-mono text-[#2A2A2A]">{u.email}</td>
                <td className="px-5 py-4">
                  <span className={`inline-flex px-2.5 py-1 rounded font-mono text-[10px] font-black uppercase ${
                    u.role === 'SUPER_ADMIN' ? 'bg-[#C59B27]/15 text-[#C59B27] border border-[#C59B27]/30' :
                    u.role === 'CATALOG_MANAGER' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                    u.role === 'ORDER_MANAGER' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                    'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {u.role.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    u.isActive 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {u.isActive ? 'Active' : 'Deactivated'}
                  </span>
                </td>
                <td className="px-5 py-4 text-right space-x-2">
                  <button
                    onClick={() => { setResetModalUser(u); setResetPasswordInput(''); }}
                    className="px-3 py-1.5 bg-[#FAF8F3] hover:bg-stone-100 text-[#064e3b] border border-stone-200 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                  >
                    <Key className="h-3 w-3" /> Reset Password
                  </button>

                  <button
                    onClick={() => toggleUserActiveStatus(u)}
                    disabled={u.id === currentUser?.id}
                    className={`px-3 py-1.5 border rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-colors disabled:opacity-40 ${
                      u.isActive
                        ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {u.isActive ? <UserX className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                    <span>{u.isActive ? 'Deactivate' : 'Activate'}</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>

      {/* Create User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-stone-200 w-full max-w-md rounded-2xl p-6 shadow-2xl text-[#2A2A2A] space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-serif font-bold text-[#2A2A2A]">Create Staff Account</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#6b6661] hover:text-[#2A2A2A]">✕</button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#2A2A2A] mb-1 font-bold">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF8F3] border border-stone-200 rounded-xl text-[#2A2A2A] font-medium focus:outline-none focus:border-[#064e3b]"
                  placeholder="e.g. Ramesh Kumar"
                />
              </div>

              <div>
                <label className="block text-[#2A2A2A] mb-1 font-bold">Work Email *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF8F3] border border-stone-200 rounded-xl text-[#2A2A2A] font-mono focus:outline-none focus:border-[#064e3b]"
                  placeholder="ramesh@countrydairy.in"
                />
              </div>

              <div>
                <label className="block text-[#2A2A2A] mb-1 font-bold">Role Scope *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF8F3] border border-stone-200 rounded-xl text-[#2A2A2A] font-bold focus:outline-none focus:border-[#064e3b]"
                >
                  <option value="CATALOG_MANAGER">Catalog Manager (Products & Banners)</option>
                  <option value="ORDER_MANAGER">Order Manager (Orders & Logistics)</option>
                  <option value="DELIVERY_DRIVER">Delivery Driver (Driver App)</option>
                  <option value="SUPER_ADMIN">Super Admin (Full Root Access)</option>
                </select>
              </div>

              <div>
                <label className="block text-[#2A2A2A] mb-1 font-bold">Initial Temporary Password *</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF8F3] border border-stone-200 rounded-xl text-[#2A2A2A] font-mono focus:outline-none focus:border-[#064e3b]"
                  placeholder="••••••••"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-xl text-[#2A2A2A] font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-[#064e3b] hover:bg-[#065f46] text-white rounded-xl font-bold shadow-sm disabled:opacity-50"
                >
                  {isSaving ? 'Creating…' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resetModalUser && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-stone-200 w-full max-w-md rounded-2xl p-6 shadow-2xl text-[#2A2A2A] space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-serif font-bold text-[#2A2A2A]">Reset Password for Staff Member</h3>
              <button onClick={() => setResetModalUser(null)} className="text-[#6b6661] hover:text-[#2A2A2A]">✕</button>
            </div>

            <p className="text-xs text-[#6b6661]">
              Set a new temporary password for <strong className="text-[#064e3b]">{displayName(resetModalUser)}</strong> ({resetModalUser.email}).
            </p>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#2A2A2A] mb-1 font-bold">New Temporary Password *</label>
                <input
                  type="text"
                  required
                  value={resetPasswordInput}
                  onChange={(e) => setResetPasswordInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF8F3] border border-stone-200 rounded-xl text-[#2A2A2A] font-mono focus:outline-none focus:border-[#064e3b]"
                  placeholder="e.g. Pass@2026Temp"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-xl text-[#2A2A2A] font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-[#064e3b] hover:bg-[#065f46] text-white rounded-xl font-bold shadow-sm disabled:opacity-50"
                >
                  {isSaving ? 'Updating…' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
