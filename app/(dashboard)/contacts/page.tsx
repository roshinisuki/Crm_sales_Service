"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getCustomersAction } from "@/app/actions/customers";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { PageShell } from "@/components/ui/PageShell";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Pagination, usePagination } from "@/components/ui/Pagination";
import { Search, Filter, BookUser, Eye, Mail, Phone, MapPin, Building, Calendar, Users, Building2, CheckCircle2, ArchiveX } from "lucide-react";
import { getInitials, getAvatarColor, cn } from "@/lib/ui-utils";

export default function ContactsPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const res = await getCustomersAction({
        search,
        status: statusFilter || undefined,
        city: cityFilter || undefined,
      });
      if (res.success && res.data) {
        setContacts(res.data);
      } else {
        toast.error(res.message || "Failed to load contacts");
      }
    } catch (e) {
      console.error(e);
      toast.error("An error occurred while loading contacts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [search, statusFilter, cityFilter]);

  // Unique cities for filter dropdown
  const cities = useMemo(() => {
    const allCities = contacts.map(c => c.city).filter(Boolean);
    return Array.from(new Set(allCities)) as string[];
  }, [contacts]);

  // Pagination logic
  const itemsPerPage = 10;
  const {
    page,
    setPage,
    totalPages,
    paged: paginatedContacts,
  } = usePagination(contacts, itemsPerPage);

  // KPI counts
  const kpiTotal = contacts.length;
  const kpiActive = contacts.filter(c => c.status === "ActiveCustomer" || c.status === "Renewed").length;
  const kpiProspects = contacts.filter(c => c.status === "Prospect").length;
  const kpiChurned = contacts.filter(c => c.status === "Churned").length;

  return (
    <PageShell
      title="Contacts"
      subtitle="Unified customer and contact directory linked to leads and deals."
    >
      <div className="space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="Total Contacts"
            value={kpiTotal}
            subtitle="All contacts"
            icon={<Users size={20} />}
            variant="blue"
          />
          <SummaryCard
            label="Active Customers"
            value={kpiActive}
            subtitle="Converted deals"
            icon={<CheckCircle2 size={20} />}
            variant="green"
          />
          <SummaryCard
            label="Prospects"
            value={kpiProspects}
            subtitle="In pipeline"
            icon={<Building2 size={20} />}
            variant="amber"
          />
          <SummaryCard
            label="Churned"
            value={kpiChurned}
            subtitle="Lost accounts"
            icon={<ArchiveX size={20} />}
            variant="red"
          />
        </div>

        {/* Filter bar */}
        <div className="crm-card bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm rounded-xl bg-slate-50 border border-slate-200 focus:outline-none w-full"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Filter size={14} /> Filter:
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              <option value="">All Statuses</option>
              <option value="Prospect">Prospect</option>
              <option value="ActiveCustomer">Active Customer</option>
              <option value="Renewed">Renewed</option>
              <option value="Churned">Churned</option>
            </select>

            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              <option value="">All Cities</option>
              {cities.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Contacts list table */}
        <div className="crm-card overflow-hidden bg-white rounded-2xl shadow-sm border border-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="px-6 py-4">Contact Code</th>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Origin Lead</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-sm text-slate-400">
                      Loading contacts directory...
                    </td>
                  </tr>
                ) : paginatedContacts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <BookUser size={20} className="text-slate-400" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">No contacts found</p>
                      <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search terms.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedContacts.map((contact) => (
                    <tr key={contact.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors text-slate-600 text-sm">
                      <td className="px-6 py-4 font-mono text-xs font-semibold text-[var(--primary)]">
                        {contact.customerCode}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white uppercase shadow-sm", getAvatarColor(contact.name))}>
                            {getInitials(contact.name)}
                          </div>
                          <div className="font-semibold text-slate-800">{contact.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {contact.email ? (
                          <div className="flex items-center gap-1.5 text-xs">
                            <Mail size={12} className="text-slate-400" />
                            {contact.email}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No email</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {contact.phone ? (
                          <div className="flex items-center gap-1.5 text-xs">
                            <Phone size={12} className="text-slate-400" />
                            {contact.phone}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No phone</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {contact.city ? (
                          <div className="flex items-center gap-1.5 text-xs">
                            <MapPin size={12} className="text-slate-400" />
                            {contact.city}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">---</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={contact.status} />
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-500">
                        {contact.convertedFromLead ? (
                          <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded">
                            Yes
                          </span>
                        ) : (
                          <span className="text-slate-300">Direct Entry</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => router.push(`/contacts/${contact.id}`)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-[var(--primary)] transition-colors inline-flex items-center justify-center"
                          title="View Contact Profile"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && contacts.length > itemsPerPage && (
            <div className="px-6 py-4 border-t border-slate-100">
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
