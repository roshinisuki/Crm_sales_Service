export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 md:pb-0">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
            Welcome back, Admin 👋
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Here's what happening in your CRM today.
          </p>
        </div>
        
        {/* Quick Nav Pills (from reference) */}
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
          <button className="px-5 py-2 rounded-full bg-white border border-slate-200 text-sm font-medium text-slate-700 whitespace-nowrap shadow-sm hover:border-slate-300">
            Visit Overview
          </button>
          <button className="px-5 py-2 rounded-full bg-white/50 border border-transparent text-sm font-medium text-slate-500 whitespace-nowrap hover:bg-white/80">
            Subscription Status
          </button>
          <button className="px-5 py-2 rounded-full bg-white/50 border border-transparent text-sm font-medium text-slate-500 whitespace-nowrap hover:bg-white/80">
            Visitor Log
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard title="Total Customers" value="2,405" trend="+12%" trendUp />
        <KpiCard title="Active Subs" value="1,842" trend="+5%" trendUp />
        <KpiCard title="Expired Subs" value="124" trend="-2%" trendDown alert />
        <KpiCard title="Today's Visits" value="48" trend="+18%" trendUp />
        <KpiCard title="Follow-ups" value="12" trend="-4%" trendDown />
        <KpiCard title="Total Visitors" value="8,902" trend="+24%" trendUp />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main Table Area (Span 2) */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <h2 className="text-xl font-bold text-slate-800">Recent Marketing Logs</h2>
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input type="text" placeholder="Search customer..." className="w-full sm:w-48 pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <button className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 flex items-center gap-2 shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                  Filter
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-xs font-semibold text-slate-500 border-b border-slate-100 uppercase tracking-wider">
                    <th className="pb-3 pl-2">Customer ID</th>
                    <th className="pb-3">Customer Name</th>
                    <th className="pb-3">Visit Type</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right pr-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                  <TableRow id="#223063" name="Jameson Doherty" type="Enterprise" status="Active" initials="JD" />
                  <TableRow id="#223064" name="Marcus Wu" type="Standard Pro" status="Active" initials="MW" />
                  <TableRow id="#223065" name="Elena Lopez" type="Basic Entry" status="Overdue" initials="EL" alert />
                  <TableRow id="#223066" name="Sarah Kinsley" type="Enterprise" status="Active" initials="SK" />
                  <TableRow id="#223067" name="Brian Truscott" type="Standard Pro" status="Suspended" initials="BT" warning />
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-6 flex justify-center items-center gap-1">
              <button className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-medium text-sm">1</button>
              <button className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-600 font-medium text-sm">2</button>
              <button className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-600 font-medium text-sm">3</button>
              <span className="w-8 h-8 flex items-center justify-center text-slate-400">...</span>
              <button className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar (Span 1) */}
        <div className="space-y-6">
          {/* Recent Activity */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Recent Activity</h2>
            <div className="space-y-4">
              <ActivityItem title="New Subscription" time="2h ago" desc="Elena Lopez upgraded to Enterprise." icon="up" color="bg-green-100 text-green-600" />
              <ActivityItem title="Follow-up Required" time="4h ago" desc="Call scheduled with Marcus Wu." icon="call" color="bg-blue-100 text-blue-600" />
              <ActivityItem title="Visit Logged" time="5h ago" desc="Jameson Doherty checked in." icon="visit" color="bg-slate-100 text-slate-600" />
              <ActivityItem title="Subscription Expired" time="1d ago" desc="Brian Truscott standard pro expired." icon="alert" color="bg-red-100 text-red-600" />
            </div>
          </div>

          {/* Audit Summary */}
          <div className="bg-gradient-to-br from-[#1a1f3c] to-slate-800 rounded-3xl p-6 shadow-md text-white">
            <h2 className="text-lg font-bold mb-2">Audit Status</h2>
            <p className="text-sm text-slate-300 mb-4">System security and compliance is up to date.</p>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Last Backup</span>
                <span className="font-medium">Today, 02:00 AM</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Failed Logins</span>
                <span className="font-medium text-red-400">3 attempts</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Active Sessions</span>
                <span className="font-medium text-cyan-400">12 users</span>
              </div>
            </div>
            <button className="w-full mt-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors">
              View Audit Logs
            </button>
          </div>
        </div>
      </div>
      
    </div>
  );
}

// Subcomponents

function KpiCard({ title, value, trend, trendUp, alert }: any) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-2xl font-bold ${alert ? 'text-red-600' : 'text-slate-800'}`}>{value}</span>
      </div>
      <div className={`mt-2 flex items-center text-xs font-medium ${trendUp ? 'text-green-600' : 'text-red-500'}`}>
        {trendUp ? (
          <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
        ) : (
           <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
        )}
        {trend} from last month
      </div>
    </div>
  );
}

function TableRow({ id, name, type, status, initials, alert, warning }: any) {
  return (
    <tr className="hover:bg-slate-50/50 transition-colors group">
      <td className="py-4 pl-2 text-slate-500 font-medium">{id}</td>
      <td className="py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold shrink-0">
            {initials}
          </div>
          <span className="font-medium text-slate-800">{name}</span>
        </div>
      </td>
      <td className="py-4 text-slate-600">{type}</td>
      <td className="py-4">
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
          alert ? 'bg-red-100 text-red-700' : 
          warning ? 'bg-amber-100 text-amber-700' : 
          'bg-blue-50 text-blue-700'
        }`}>
          {status}
        </span>
      </td>
      <td className="py-4 pr-2 text-right">
        <button className="text-slate-400 hover:text-slate-800 p-1 rounded-lg hover:bg-slate-100 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
        </button>
      </td>
    </tr>
  );
}

function ActivityItem({ title, time, desc, color }: any) {
  return (
    <div className="flex gap-4">
      <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${color}`}>
         <div className="w-2.5 h-2.5 rounded-full bg-current" />
      </div>
      <div>
        <p className="text-sm font-bold text-slate-800">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
        <p className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-wide">{time}</p>
      </div>
    </div>
  );
}
