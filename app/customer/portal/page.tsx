import { getMeAction } from "@/app/actions/auth";
import { redirect } from "next/navigation";

export default async function CustomerPortalPage() {
  const userRes = await getMeAction();
  if (!userRes.success || !userRes.data || userRes.data.role !== "Customer") {
    redirect("/login");
  }

  const user = userRes.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {user.name}</h1>
        <p className="text-slate-500 mt-1">Manage your Suki Software subscriptions and profile.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 col-span-2">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Your Subscriptions</h2>
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-8 text-center">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            </div>
            <h3 className="text-slate-700 font-medium mb-1">No active subscriptions</h3>
            <p className="text-sm text-slate-500">Contact your sales representative to add services.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Profile</h2>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Name</p>
              <p className="text-sm font-medium text-slate-800">{user.name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Email</p>
              <p className="text-sm font-medium text-slate-800">{user.email}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Account Status</p>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                Active
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
