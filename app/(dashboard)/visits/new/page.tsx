"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { PageShell } from "@/components/ui/PageShell";
import { FormField, Input, Textarea, Select } from "@/components/ui/FormField";
import { cn } from "@/lib/ui-utils";
import { getCustomersAction } from "@/app/actions/customers";
import { Search, X, Check, MapPin, Building2, CalendarClock, Users } from "lucide-react";

const PURPOSE_OPTIONS = [
  "Demo", "Technical Discussion", "Commercial Meeting",
  "Relationship Visit", "Complaint Resolution",
];

export default function NewVisitPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountId = searchParams.get("accountId");
  const toast = useToast();

  const [customers, setCustomers] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  const [form, setForm] = useState({
    visitType: "field_visit",
    customerId: "",
    location: "",
    purpose: "",
    plannedDate: "",
    plannedTime: "09:00",
    assignedTo: "",
    linkedOpportunityId: "",
    agenda: "",
    attendeeContactIds: [] as string[],
    // Office visit specific
    visitorNames: "",
    meetingRoom: "",
    documentsExchanged: "",
    hostedByUserIds: [] as string[],
    visitors: [] as { name: string; designation?: string }[],
    // Field visit specific
    travelMode: "",
    distanceTraveledKm: "",
    expenseAmount: "",
  });

  const [showOptional, setShowOptional] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setGpsLoading(true);
    toast.info("Capturing your location...");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          if (res.ok) {
            const data = await res.json();
            setForm(prev => ({ ...prev, location: data.display_name || `${latitude}, ${longitude}` }));
            toast.success("Location auto-filled successfully!");
          } else {
            setForm(prev => ({ ...prev, location: `${latitude}, ${longitude}` }));
            toast.warning("Failed to resolve address. Coordinates filled instead.");
          }
        } catch {
          setForm(prev => ({ ...prev, location: `${latitude}, ${longitude}` }));
          toast.warning("Network error resolving address. Coordinates filled instead.");
        } finally {
          setGpsLoading(false);
        }
      },
      (err) => {
        setGpsLoading(false);
        toast.error("Failed to capture GPS location: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Fetch contacts and opportunities when customer is selected
  const loadCustomerData = useCallback(async (customerId: string) => {
    if (!customerId) {
      setContacts([]);
      setOpportunities([]);
      return;
    }
    const [contactRes, oppRes] = await Promise.all([
      fetch(`/api/contacts?customerId=${customerId}`),
      fetch(`/api/opportunities?search=&customerId=${customerId}`),
    ]);
    if (contactRes.ok) {
      const contactData = await contactRes.json();
      setContacts(contactData.data || []);
    }
    if (oppRes.ok) {
      const oppData = await oppRes.json();
      setOpportunities(oppData.data || []);
    }
  }, []);

  // Fetch customers
  useEffect(() => {
    getCustomersAction().then((res) => {
      if (res.success && res.data) {
        setCustomers(res.data as any[]);
        if (accountId) {
          setForm((prev) => ({ ...prev, customerId: accountId }));
          loadCustomerData(accountId);
        }
      }
    });
    fetch("/api/users").then((res) => res.json()).then((data) => {
      if (data.success) setUsers(data.data || []);
    });
  }, [accountId, loadCustomerData]);

  const handleCustomerSelect = (customerId: string) => {
    setForm((prev) => ({
      ...prev,
      customerId,
      location: "",
      attendeeContactIds: [],
      linkedOpportunityId: "",
    }));
    loadCustomerData(customerId);
  };

  const toggleAttendee = (contactId: string) => {
    setForm((prev) => ({
      ...prev,
      attendeeContactIds: prev.attendeeContactIds.includes(contactId)
        ? prev.attendeeContactIds.filter((id) => id !== contactId)
        : [...prev.attendeeContactIds, contactId],
    }));
  };

  const addVisitor = () => {
    setForm((prev) => ({
      ...prev,
      visitors: [...prev.visitors, { name: "", designation: "" }],
    }));
  };

  const removeVisitor = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      visitors: prev.visitors.filter((_, i) => i !== idx),
    }));
  };

  const updateVisitor = (idx: number, field: "name" | "designation", value: string) => {
    setForm((prev) => {
      const updated = [...prev.visitors];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, visitors: updated };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId) { toast.error("Please select an account"); return; }
    if (!form.purpose) { toast.error("Purpose is required"); return; }
    if (!form.plannedDate) { toast.error("Planned date is required"); return; }
    if (form.visitType === "field_visit" && !form.location) { toast.error("Location is required for field visits"); return; }
    if (form.visitType === "office_visit" && !form.visitorNames && form.visitors.length === 0) { toast.error("Visitor names or visitor list is required for office visits"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitType: form.visitType,
          customerId: form.customerId,
          location: form.visitType === "field_visit" ? form.location : undefined,
          purpose: form.purpose,
          plannedDate: form.plannedDate,
          plannedTime: form.plannedTime,
          assignedTo: form.assignedTo || undefined,
          attendeeContactIds: form.attendeeContactIds,
          linkedOpportunityId: form.linkedOpportunityId || undefined,
          agenda: form.agenda,
          visitorNames: form.visitType === "office_visit" ? form.visitorNames : undefined,
          meetingRoom: form.visitType === "office_visit" ? form.meetingRoom : undefined,
          documentsExchanged: form.visitType === "office_visit" ? form.documentsExchanged : undefined,
          hostedByUserIds: form.visitType === "office_visit" ? form.hostedByUserIds : undefined,
          visitors: form.visitType === "office_visit" ? form.visitors : undefined,
          travelMode: form.visitType === "field_visit" ? form.travelMode : undefined,
          distanceTraveledKm: form.visitType === "field_visit" && form.distanceTraveledKm ? parseFloat(form.distanceTraveledKm) : undefined,
          expenseAmount: form.visitType === "field_visit" && form.expenseAmount ? parseFloat(form.expenseAmount) : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Visit planned successfully");
        router.push(`/visits/${data.data.id}`);
      } else {
        toast.error(data.message || "Failed to plan visit");
      }
    } catch {
      toast.error("Failed to plan visit");
    } finally {
      setSaving(false);
    }
  };

  const filteredCustomers = customers.filter((c: any) => {
    if (!customerSearch) return true;
    const q = customerSearch.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.customerCode?.toLowerCase().includes(q);
  });

  const selectedCustomer = customers.find((c) => c.id === form.customerId);

  return (
    <PageShell
      title="Plan Visit"
      subtitle="Schedule a customer visit with attendees and location"
      breadcrumb={[{ label: "Visits", href: "/visits" }]}
    >
      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
        {/* Account Search */}
        <div className="crm-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Select Account</h3>
              <p className="text-xs text-[var(--text-tertiary)]">Choose the customer you want to visit</p>
            </div>
          </div>
          <FormField label="Search Account" required>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input
                type="text"
                placeholder="Search by name or code..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="pl-9 rounded-xl"
              />
            </div>
          </FormField>
          {form.customerId ? (
            <div className="flex items-center justify-between p-4 bg-brand-light border border-brand-border rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center">
                  <Check className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-brand-text">{selectedCustomer?.name}</p>
                  <p className="text-xs text-brand-text opacity-70">{selectedCustomer?.customerCode} — {selectedCustomer?.city}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setForm({ ...form, customerId: "" }); setContacts([]); }}
                className="text-text-muted hover:text-danger-text transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto border border-border rounded-xl divide-y divide-border-subtle">
              {filteredCustomers.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-4">No accounts found</p>
              ) : (
                filteredCustomers.slice(0, 20).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleCustomerSelect(c.id)}
                    className="w-full text-left px-4 py-3 hover:bg-border-subtle transition-colors"
                  >
                    <p className="text-sm font-bold text-text-primary">{c.name}</p>
                    <p className="text-xs text-text-muted">{c.customerCode} — {c.city}</p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Visit Details */}
        {form.customerId && (
          <>
            <div className="crm-card p-6 space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Visit Details</h3>
                  <p className="text-xs text-[var(--text-tertiary)]">Configure visit location and scheduling</p>
                </div>
              </div>

              {/* LOCATION / VISITOR NAMES (FIRST) */}
              <div className="grid grid-cols-1 gap-4">
                {form.visitType === "field_visit" && (
                  <FormField label="Location" required hint="Enter the customer's address or location">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type="text"
                          value={form.location || ""}
                          onChange={(e) => setForm({ ...form, location: e.target.value })}
                          placeholder="e.g. 123 Industrial Area, City"
                          className="rounded-xl"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleUseCurrentLocation}
                        disabled={gpsLoading}
                        className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <MapPin size={14} />
                        {gpsLoading ? "Locating..." : "Use Current Location"}
                      </button>
                    </div>
                  </FormField>
                )}
                {form.visitType === "office_visit" && (
                  <FormField label="Visitor Names" required>
                    <Input
                      type="text"
                      value={form.visitorNames}
                      onChange={(e) => setForm({ ...form, visitorNames: e.target.value })}
                      placeholder="Enter visitor names from customer..."
                      className="rounded-xl"
                    />
                  </FormField>
                )}
              </div>

              {/* VISIT TYPE TOGGLE (BELOW LOCATION) */}
              <FormField label="Visit Type" required>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, visitType: "field_visit" })}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      form.visitType === "field_visit"
                        ? "border-[var(--primary)] bg-[var(--primary-light)]"
                        : "border-border hover:border-border-subtle bg-transparent hover:bg-card-hover"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        form.visitType === "field_visit" ? "bg-[var(--primary)]" : "bg-border-subtle"
                      }`}>
                        <MapPin className={`w-5 h-5 ${form.visitType === "field_visit" ? "text-white" : "text-text-muted"}`} />
                      </div>
                      <div className="text-center">
                        <p className={`text-sm font-semibold ${form.visitType === "field_visit" ? "text-[var(--primary)]" : "text-text-primary"}`}>Field Visit</p>
                        <p className="text-[10px] text-text-muted">We travel to customer</p>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, visitType: "office_visit" })}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      form.visitType === "office_visit"
                        ? "border-[var(--primary)] bg-[var(--primary-light)]"
                        : "border-border hover:border-border-subtle bg-transparent hover:bg-card-hover"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        form.visitType === "office_visit" ? "bg-[var(--primary)]" : "bg-border-subtle"
                      }`}>
                        <Building2 className={`w-5 h-5 ${form.visitType === "office_visit" ? "text-white" : "text-text-muted"}`} />
                      </div>
                      <div className="text-center">
                        <p className={`text-sm font-semibold ${form.visitType === "office_visit" ? "text-[var(--primary)]" : "text-text-primary"}`}>Office Visit</p>
                        <p className="text-[10px] text-text-muted">Customer travels to us</p>
                      </div>
                    </div>
                  </button>
                </div>
              </FormField>

              {/* CORE REQUIRED FIELDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Purpose" required>
                  <Select
                    value={form.purpose}
                    onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                    className="rounded-xl"
                  >
                    <option value="">Select purpose...</option>
                    {PURPOSE_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Assigned To">
                  <Select
                    value={form.assignedTo}
                    onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                    className="rounded-xl"
                  >
                    <option value="">Yourself (default)</option>
                    {users.filter((u) => u.role !== "Customer").map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Planned Date" required>
                  <Input
                    type="date"
                    value={form.plannedDate}
                    onChange={(e) => setForm({ ...form, plannedDate: e.target.value })}
                    min={new Date().toISOString().split("T")[0]}
                    className="rounded-xl"
                  />
                </FormField>
                <FormField label="Planned Time">
                  <Input
                    type="time"
                    value={form.plannedTime}
                    onChange={(e) => setForm({ ...form, plannedTime: e.target.value })}
                    className="rounded-xl"
                  />
                </FormField>
              </div>

              {/* EXPANDABLE OPTIONAL SECTION */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowOptional(!showOptional)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
                >
                  {showOptional ? "Hide optional details" : "Add more details (Travel, Agenda, Opportunity...)"}
                </button>
              </div>

              {showOptional && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-white/5 animate-in fade-in slide-in-from-top-2 duration-200">
                  {form.visitType === "field_visit" && (
                    <>
                      <FormField label="Travel Mode">
                        <Select
                          value={form.travelMode}
                          onChange={(e) => setForm({ ...form, travelMode: e.target.value })}
                          className="rounded-xl"
                        >
                          <option value="">Select travel mode...</option>
                          <option value="Car">Car</option>
                          <option value="Bike">Bike</option>
                          <option value="Public Transport">Public Transport</option>
                          <option value="Flight">Flight</option>
                          <option value="Other">Other</option>
                        </Select>
                      </FormField>
                      <FormField label="Estimated Distance (km)">
                        <Input
                          type="number"
                          step="0.1"
                          value={form.distanceTraveledKm}
                          onChange={(e) => setForm({ ...form, distanceTraveledKm: e.target.value })}
                          placeholder="e.g. 25.5"
                          className="rounded-xl"
                        />
                      </FormField>
                      <FormField label="Estimated Expense (₹)">
                        <Input
                          type="number"
                          step="0.01"
                          value={form.expenseAmount}
                          onChange={(e) => setForm({ ...form, expenseAmount: e.target.value })}
                          placeholder="e.g. 500.00"
                          className="rounded-xl"
                        />
                      </FormField>
                    </>
                  )}
                  {form.visitType === "office_visit" && (
                    <>
                      <FormField label="Meeting Room">
                        <Input
                          type="text"
                          value={form.meetingRoom}
                          onChange={(e) => setForm({ ...form, meetingRoom: e.target.value })}
                          placeholder="e.g. Conference Room A"
                        />
                      </FormField>
                      <FormField label="Documents Exchanged">
                        <Textarea
                          rows={2}
                          value={form.documentsExchanged}
                          onChange={(e) => setForm({ ...form, documentsExchanged: e.target.value })}
                          placeholder="e.g., Brochure, Quotation, Technical datasheet..."
                          className="rounded-xl"
                        />
                      </FormField>
                      <FormField label="Host(s) (multi-select)">
                        <div className="flex flex-wrap gap-2">
                          {users.filter((u) => u.role !== "Customer").map((u) => {
                            const isSelected = form.hostedByUserIds.includes(u.id);
                            return (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => setForm((prev) => ({
                                  ...prev,
                                  hostedByUserIds: isSelected
                                    ? prev.hostedByUserIds.filter((id) => id !== u.id)
                                    : [...prev.hostedByUserIds, u.id],
                                }))}
                                className={cn(
                                  "px-3 py-1.5 text-xs font-bold rounded-lg border-2 transition-all",
                                  isSelected
                                    ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                                    : "border-border bg-transparent text-text-secondary hover:border-border-subtle hover:bg-border-subtle"
                                )}
                              >
                                {u.name}
                              </button>
                            );
                          })}
                        </div>
                      </FormField>
                    </>
                  )}
                  <FormField label="Link Opportunity (optional)">
                    <Select
                      value={form.linkedOpportunityId}
                      onChange={(e) => setForm({ ...form, linkedOpportunityId: e.target.value })}
                      className="rounded-xl"
                    >
                      <option value="">None</option>
                      {opportunities.map((opp) => (
                        <option key={opp.id} value={opp.id}>{opp.dealName} ({opp.opportunityCode})</option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Visitor List (optional)">
                    <div className="space-y-2">
                      {form.visitors.map((v, idx) => (
                        <div key={idx} className="flex gap-2">
                          <Input
                            value={v.name}
                            onChange={(e) => updateVisitor(idx, "name", e.target.value)}
                            placeholder="Visitor name"
                            className="rounded-xl"
                          />
                          <Input
                            value={v.designation || ""}
                            onChange={(e) => updateVisitor(idx, "designation", e.target.value)}
                            placeholder="Designation (optional)"
                            className="rounded-xl"
                          />
                          <button
                            type="button"
                            onClick={() => removeVisitor(idx)}
                            className="text-rose-500 hover:text-rose-700"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addVisitor}
                        className="text-sm text-[var(--primary)] font-medium hover:underline"
                      >
                        + Add Visitor
                      </button>
                    </div>
                  </FormField>
                  <div className="md:col-span-2">
                    <FormField label="Agenda">
                      <Textarea
                        rows={3}
                        value={form.agenda}
                        onChange={(e) => setForm({ ...form, agenda: e.target.value })}
                        placeholder="Visit agenda and discussion points..."
                        className="rounded-xl"
                      />
                    </FormField>
                  </div>
                </div>
              )}
            </div>

            {/* Attendees Multi-Select */}
            <div className="crm-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Attendees</h3>
                  <p className="text-xs text-[var(--text-tertiary)]">Select contacts from this account to attend the visit</p>
                </div>
              </div>
              {contacts.length === 0 ? (
                <div className="p-4 bg-border-subtle border border-border rounded-xl text-center">
                  <p className="text-sm text-text-muted">No contacts found for this account</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {contacts.map((c) => {
                    const isSelected = form.attendeeContactIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleAttendee(c.id)}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left",
                          isSelected
                            ? "border-[var(--primary)] bg-[var(--primary-light)]"
                            : "border-border bg-transparent hover:border-border-subtle hover:bg-card-hover hover:shadow-sm"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isSelected ? "bg-[var(--primary)]" : "bg-border-subtle"
                          }`}>
                            {isSelected ? <Check size={16} className="text-white" /> : <span className="text-xs font-bold text-text-muted">{c.name.charAt(0)}</span>}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-text-primary">{c.name}</p>
                            <p className="text-xs text-text-muted">{c.designation || c.contactType}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {form.attendeeContactIds.length > 0 && (
                <div className="mt-3 flex items-center gap-2 p-3 bg-success-bg border border-success-border rounded-xl">
                  <Check size={16} className="text-success-text" />
                  <p className="text-sm font-semibold text-success-text">
                    {form.attendeeContactIds.length} attendee{form.attendeeContactIds.length !== 1 ? "s" : ""} selected
                  </p>
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-6 py-3 bg-[var(--primary)] text-white font-semibold text-sm rounded-xl hover:bg-[var(--primary-hover)] transition-all shadow-sm hover:shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {saving ? "Planning..." : "Plan Visit"}
              </button>
              <button
                type="button"
                onClick={() => router.push("/visits")}
                className="px-6 py-2.5 text-text-primary font-semibold text-sm rounded-xl bg-border-subtle hover:bg-border transition-all"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </form>
    </PageShell>
  );
}
