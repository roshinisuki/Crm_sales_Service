"use client";

import { useState, useEffect } from "react";
import { PageShell } from "@/components/ui/PageShell";
import PageContainer from "@/components/PageContainer";
import { useToast } from "@/components/ToastProvider";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { getUsersAction, updateUserAction } from "@/app/actions/users";
import { Users, Shield, Award, Briefcase, RefreshCw, UserCheck } from "lucide-react";

export default function RolesSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getUsersAction();
      if (res.success && res.data) {
        setUsers(res.data);
      } else {
        toast.error(res.message || "Failed to load users");
      }
    } catch (err: any) {
      toast.error("Error loading users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      if (user.role !== "Admin") {
        router.replace("/dashboard");
      } else {
        loadData();
      }
    }
  }, [user, authLoading, router]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingId(userId);
    try {
      const res = await updateUserAction({ id: userId, role: newRole });
      if (res.success) {
        toast.success(`Role updated successfully to ${newRole}`);
        loadData();
      } else {
        toast.error(res.message || "Failed to update role");
      }
    } catch (err) {
      toast.error("An error occurred while updating role");
    } finally {
      setUpdatingId(null);
    }
  };

  if (authLoading || !user || user.role !== "Admin") {
    return null;
  }

  // Group users by role
  const admins = users.filter((u) => u.role === "Admin");
  const managers = users.filter((u) => u.role === "SalesManager");
  const executives = users.filter((u) => u.role === "SalesExecutive");

  return (
    <PageShell
      title="Roles & Permissions"
      subtitle="Manage distinct roles in use and assign user roles"
    >
      <PageContainer className="space-y-6">
        {/* Role Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
              <Shield size={24} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">Admins</h4>
              <p className="text-2xl font-black text-slate-900 mt-1">{admins.length}</p>
              <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Full system control</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Award size={24} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">Sales Managers</h4>
              <p className="text-2xl font-black text-slate-900 mt-1">{managers.length}</p>
              <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Team & lead managers</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Briefcase size={24} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">Sales Executives</h4>
              <p className="text-2xl font-black text-slate-900 mt-1">{executives.length}</p>
              <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Direct execution staff</p>
            </div>
          </div>
        </div>

        {/* Users & Roles Assignment Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-[#FAF6F3]">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">User Role Assignments</h3>
              <p className="text-[10px] text-slate-500 font-medium">Change roles dynamically for members of your organization</p>
            </div>
            <button
              onClick={loadData}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
              title="Refresh Users"
            >
              <RefreshCw size={15} />
            </button>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="crm-table w-full text-left border-collapse">
              <thead>
                <tr className="crm-tr border-b border-slate-100 bg-slate-50/50">
                  <th className="crm-th px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">User Name</th>
                  <th className="crm-th px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Email Address</th>
                  <th className="crm-th px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Current Role</th>
                  <th className="crm-th px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                  <th className="crm-th px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider text-right">Assign New Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-slate-400 text-xs">
                      Loading user records...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400 text-xs">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const isSelf = u.id === user.id;

                    return (
                      <tr key={u.id} className="crm-tr hover:bg-slate-50/40 transition-colors">
                        <td className="crm-td px-5 py-4 font-bold text-slate-800 text-sm">
                          <div className="flex items-center gap-2">
                            <span>{u.name}</span>
                            {isSelf && (
                              <span className="text-[9px] bg-slate-100 text-slate-500 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                You
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="crm-td px-5 py-4 text-slate-500 font-medium text-xs font-mono">
                          {u.email}
                        </td>
                        <td className="crm-td px-5 py-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            u.role === "Admin"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : u.role === "SalesManager"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}>
                            {u.role === "Admin" ? "Administrator" : u.role === "SalesManager" ? "Sales Manager" : "Sales Executive"}
                          </span>
                        </td>
                        <td className="crm-td px-5 py-4">
                          {u.isActive ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-50 text-green-700 border border-green-200">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="crm-td px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {updatingId === u.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-600 mr-4"></div>
                            ) : (
                              <select
                                disabled={isSelf} // Self role lockout safeguard
                                value={u.role}
                                onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                className={`px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold cursor-pointer focus:outline-none bg-slate-50 ${isSelf ? "opacity-60 cursor-not-allowed" : "hover:bg-slate-100/60"}`}
                                title={isSelf ? "Cannot change your own role" : "Change user role"}
                              >
                                <option value="Admin">Admin</option>
                                <option value="SalesManager">SalesManager</option>
                                <option value="SalesExecutive">SalesExecutive</option>
                              </select>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PageContainer>
    </PageShell>
  );
}
