import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Edit,
  Mail,
  Shield,
  Bus,
  Route as RouteIcon,
  KeyRound,
  CheckCircle,
  Search,
  X
} from 'lucide-react';
import { usersApi, busesApi, routesApi } from '../../api/index.js';
import LoadingSpinner from '../../components/ui/LoadingSpinner.jsx';

export default function UsersAdmin() {
  const [users, setUsers] = useState([]);
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'driver',
    assignedBus: '',
    assignedRoute: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [uRes, bRes, rRes] = await Promise.all([
        usersApi.list(),
        busesApi.list(),
        routesApi.list(),
      ]);
      setUsers(uRes.data || []);
      setBuses(bRes.data || []);
      setRoutes(rRes.data || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'driver',
      assignedBus: '',
      assignedRoute: '',
    });
    setShowModal(true);
  };

  const openEditModal = (u) => {
    setEditingUser(u);
    setFormData({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      assignedBus: u.assignedBus?._id || u.assignedBus || '',
      assignedRoute: u.assignedRoute?._id || u.assignedRoute || '',
    });
    setShowModal(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        role: formData.role,
        assignedBus: formData.assignedBus || null,
        assignedRoute: formData.assignedRoute || null,
      };
      if (formData.password) {
        payload.password = formData.password;
      }

      if (editingUser) {
        await usersApi.update(editingUser._id, payload);
      } else {
        if (!formData.password) {
          alert('Password is required for new users.');
          return;
        }
        await usersApi.create(payload);
      }

      setShowModal(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save user:', err);
      alert(err.response?.data?.error?.message || 'Failed to save user.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      setActionLoading(true);
      await usersApi.delete(id);
      await loadData();
    } catch (err) {
      console.error('Failed to delete user:', err);
      alert('Failed to delete user.');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingSpinner fullscreen />;

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-surface-900 dark:text-surface-100 tracking-tight flex items-center gap-3">
            <Users className="w-7 h-7 text-primary-600" />
            User & Driver Directory
          </h1>
          <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
            Manage system administrators, transit drivers, and assigned fleet vehicles
          </p>
        </div>

        <button
          onClick={openCreateModal}
          id="create-user-btn"
          className="btn-primary rounded-full py-2.5 px-5 text-sm font-semibold flex items-center gap-2 self-start sm:self-auto shadow-soft-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add User</span>
        </button>
      </div>

      {/* Filter */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-surface-400 dark:text-surface-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Filter by name, email, or role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-10"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#28292c] rounded-3xl border border-surface-200 dark:border-surface-800 shadow-soft-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/80 text-xs text-surface-600 dark:text-surface-300 uppercase tracking-wider">
              <tr>
                <th className="p-4 font-semibold">User</th>
                <th className="p-4 font-semibold">System Role</th>
                <th className="p-4 font-semibold">Assigned Duty</th>
                <th className="p-4 font-semibold">Created Date</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200/70 dark:divide-surface-700/60 text-surface-700 dark:text-surface-300">
              {filteredUsers.map((u) => {
                const bus = buses.find(b => b._id === (u.assignedBus?._id || u.assignedBus));
                const route = routes.find(r => r._id === (u.assignedRoute?._id || u.assignedRoute)) ||
                              (bus?.defaultRouteId ? routes.find(r => r._id === (bus.defaultRouteId?._id || bus.defaultRouteId)) : null);

                return (
                  <tr key={u._id} className="hover:bg-surface-50/70 dark:hover:bg-surface-800/50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-surface-900 dark:text-surface-100">{u.name}</div>
                      <div className="text-xs text-surface-500 dark:text-surface-400 flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3.5 h-3.5 text-surface-400 dark:text-surface-500" />
                        <span>{u.email}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                        u.role === 'admin'
                          ? 'bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800/60'
                          : u.role === 'driver'
                          ? 'bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800/60'
                          : 'bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 border-surface-200 dark:border-surface-700'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-surface-600 dark:text-surface-400">
                      {u.role === 'driver' ? (
                        <div className="space-y-1">
                          {bus ? (
                            <div className="flex items-center gap-1.5 font-semibold text-surface-800 dark:text-surface-200">
                              <Bus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>{bus.name} ({bus.plateNo})</span>
                            </div>
                          ) : (
                            <div className="text-amber-600 dark:text-amber-400 text-[11px] flex items-center gap-1">
                              <span>No bus assigned</span>
                            </div>
                          )}
                          {route ? (
                            <div className="flex items-center gap-1.5 text-surface-700 dark:text-surface-300 font-medium">
                              <RouteIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              <span>{route.name}</span>
                            </div>
                          ) : (
                            <div className="text-amber-600 dark:text-amber-400 text-[11px] flex items-center gap-1">
                              <span>No route assigned</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-surface-400 dark:text-surface-500">—</span>
                      )}
                    </td>
                    <td className="p-4 text-xs text-surface-500 dark:text-surface-400">
                      {new Date(u.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(u)}
                          className="p-2 rounded-full text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                          title="Edit User"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u._id)}
                          className="p-2 rounded-full text-surface-400 hover:text-google-red hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#28292c] max-w-md w-full p-6 sm:p-7 rounded-3xl border border-surface-200 dark:border-surface-800 shadow-soft-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
                {editingUser ? 'Edit User' : 'Create New User'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-full text-surface-400 hover:text-surface-700 dark:hover:text-surface-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="label">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="label">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="user@campus.edu"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="label">
                  Password {editingUser && '(Leave blank to keep unchanged)'}
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="label">
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="input cursor-pointer"
                >
                  <option value="driver">Driver (Broadcast live GPS telemetry)</option>
                  <option value="admin">Admin (Full transit management)</option>
                  <option value="student">Student (Read only)</option>
                </select>
              </div>

              {formData.role === 'driver' && (
                <>
                  <div>
                    <label className="label">
                      Assigned Bus (Optional)
                    </label>
                    <select
                      value={formData.assignedBus}
                      onChange={(e) => setFormData({ ...formData, assignedBus: e.target.value })}
                      className="input cursor-pointer"
                    >
                      <option value="">-- No Bus Assigned --</option>
                      {buses.map(b => (
                        <option key={b._id} value={b._id}>
                          {b.name} ({b.plateNo})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">
                      Assigned Route (Optional)
                    </label>
                    <select
                      value={formData.assignedRoute}
                      onChange={(e) => setFormData({ ...formData, assignedRoute: e.target.value })}
                      className="input cursor-pointer"
                    >
                      <option value="">-- No Route Assigned (Use Bus Default) --</option>
                      {routes.map(r => (
                        <option key={r._id} value={r._id}>
                          {r.name} {r.type === 'event' ? '★ (Event)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-200 dark:border-surface-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-subtle px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-primary text-xs font-semibold py-2 px-5 rounded-full shadow-soft-xs"
                >
                  {actionLoading ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
