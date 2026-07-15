"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import ServiceSettingsCRUD from "@/components/shared/ServiceSettingsCRUD";
import { 
  FolderKey, AlertOctagon, HelpCircle, Flame, 
  BarChart, Users, Settings, Wrench, HardDrive, Package 
} from "lucide-react";
import { cn } from "@/lib/ui-utils";

type SettingKey = 
  | "categories" 
  | "complaints" 
  | "defects" 
  | "priorities" 
  | "statuses" 
  | "teams" 
  | "engineers" 
  | "assets"
  | "spare-parts"
  | "escalation-rules";

export default function ServiceSettingsPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get("tab");
  const [activeTab, setActiveTab] = useState<SettingKey>("categories");
  const [refData, setRefData] = useState<Record<string, { value: string; label: string }[]>>({});

  useEffect(() => {
    if (tabParam && ["categories", "complaints", "defects", "priorities", "statuses", "teams", "engineers", "assets", "spare-parts", "escalation-rules"].includes(tabParam)) {
      setActiveTab(tabParam as SettingKey);
    }
  }, [tabParam]);

  useEffect(() => {
    const fetchRefData = async () => {
      try {
        const [usersRes, refRes] = await Promise.all([
          fetch("/api/users"),
          fetch("/api/service/reference-data"),
        ]);
        const users = usersRes.ok ? await usersRes.json() : [];
        const ref = refRes.ok ? await refRes.json() : {};

        setRefData({
          users: (users.data || users || []).map((u: any) => ({ value: u.id, label: u.name || u.email })),
          teams: (ref.ServiceTeam || []).map((t: any) => ({ value: t.value, label: t.label })),
          customers: (ref.Customer || []).map((c: any) => ({ value: c.value, label: c.label })),
          categories: (ref.ServiceCategory || []).map((c: any) => ({ value: c.value, label: c.label })),
          priorities: (ref.PriorityLevel || []).map((p: any) => ({ value: p.value, label: p.label })),
        });
      } catch (e) {
        console.error("Failed to fetch ref data for settings:", e);
      }
    };
    fetchRefData();
  }, []);

  const tabs: { key: SettingKey; label: string; icon: React.ReactNode }[] = [
    { key: "categories", label: "Service Categories", icon: <FolderKey size={15} /> },
    { key: "complaints", label: "Complaint Types", icon: <AlertOctagon size={15} /> },
    { key: "defects", label: "Defect Types", icon: <HelpCircle size={15} /> },
    { key: "priorities", label: "Priority Levels", icon: <Flame size={15} /> },
    { key: "statuses", label: "Service Statuses", icon: <BarChart size={15} /> },
    { key: "teams", label: "Service Teams", icon: <Users size={15} /> },
    { key: "engineers", label: "Service Engineers", icon: <Wrench size={15} /> },
    { key: "assets", label: "Customer Assets", icon: <HardDrive size={15} /> },
    { key: "spare-parts", label: "Spare Parts", icon: <Package size={15} /> },
    { key: "escalation-rules", label: "Escalation Rules", icon: <AlertOctagon size={15} /> },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[75vh]">
      {/* Settings Navigation Sidebar */}
      <div className="w-full lg:w-64 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 space-y-1 backdrop-blur-md self-start">
        <h3 className="px-3.5 pb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Service Metadata Settings
        </h3>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all text-left",
                isActive 
                  ? "bg-[var(--surface-2)] text-[var(--text-primary)] border border-[var(--border)] shadow-sm" 
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] border border-transparent"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Settings Content Area */}
      <div className="flex-1 min-w-0">
        {activeTab === "categories" && (
          <ServiceSettingsCRUD
            modelName="serviceCategory"
            title="Service Category"
            fields={[
              { id: "name", label: "Category Name", type: "text", required: true },
              { id: "description", label: "Description", type: "textarea" },
            ]}
          />
        )}

        {activeTab === "complaints" && (
          <ServiceSettingsCRUD
            modelName="complaintType"
            title="Complaint Type"
            fields={[
              { id: "name", label: "Complaint Type Name", type: "text", required: true },
              { id: "description", label: "Description", type: "textarea" },
            ]}
          />
        )}

        {activeTab === "defects" && (
          <ServiceSettingsCRUD
            modelName="defectType"
            title="Defect Type"
            fields={[
              { id: "name", label: "Defect Type Name", type: "text", required: true },
              { id: "description", label: "Description", type: "textarea" },
            ]}
          />
        )}

        {activeTab === "priorities" && (
          <ServiceSettingsCRUD
            modelName="priorityLevel"
            title="Priority Level"
            fields={[
              { id: "name", label: "Priority Name", type: "text", required: true },
              { id: "color", label: "Label Color (Hex)", type: "color", required: true },
              { id: "slaLimitHours", label: "SLA Resolution Limit (Hours)", type: "number", required: true },
            ]}
          />
        )}

        {activeTab === "statuses" && (
          <ServiceSettingsCRUD
            modelName="serviceStatus"
            title="Service Status"
            fields={[
              { id: "name", label: "Status Name", type: "text", required: true },
              { id: "color", label: "Label Color (Hex)", type: "color", required: true },
              { id: "order", label: "Display Order", type: "number", required: true },
              { id: "allowedTransitions", label: "Allowed Transitions (JSON)", type: "textarea" },
            ]}
          />
        )}

        {activeTab === "teams" && (
          <ServiceSettingsCRUD
            modelName="serviceTeam"
            title="Service Team"
            fields={[
              { id: "name", label: "Team Name", type: "text", required: true },
              { id: "description", label: "Description", type: "textarea" },
              { id: "managerId", label: "Manager", type: "select", options: refData.users || [] },
            ]}
          />
        )}

        {activeTab === "engineers" && (
          <ServiceSettingsCRUD
            modelName="serviceEngineer"
            title="Service Engineer"
            fields={[
              { id: "userId", label: "User", type: "select", required: true, options: refData.users || [] },
              { id: "teamId", label: "Team", type: "select", required: true, options: refData.teams || [] },
              { id: "specialization", label: "Specialization Areas", type: "text" },
            ]}
          />
        )}

        {activeTab === "assets" && (
          <ServiceSettingsCRUD
            modelName="customerAsset"
            title="Customer Asset"
            fields={[
              { id: "customerId", label: "Customer", type: "select", required: true, options: refData.customers || [] },
              { id: "serialNumber", label: "Serial Number", type: "text", required: true },
              { id: "productName", label: "Product/Model Name", type: "text", required: true },
              { id: "purchaseDate", label: "Purchase Date", type: "date" },
              { id: "warrantyExpiryDate", label: "Warranty Expiry Date", type: "date" },
              { id: "amcExpiryDate", label: "AMC Expiry Date", type: "date" },
            ]}
          />
        )}

        {activeTab === "spare-parts" && (
          <ServiceSettingsCRUD
            modelName="sparePart"
            title="Spare Part"
            fields={[
              { id: "partCode", label: "Part Code", type: "text", required: true },
              { id: "partName", label: "Part Name", type: "text", required: true },
              { id: "category", label: "Category", type: "text" },
              { id: "unit", label: "Unit (e.g. pcs, set, meter)", type: "text" },
              { id: "unitCost", label: "Unit Cost", type: "number", required: true },
              { id: "currency", label: "Currency", type: "text" },
              { id: "currentStock", label: "Current Stock", type: "number" },
              { id: "isActive", label: "Active", type: "boolean" },
            ]}
          />
        )}

        {activeTab === "escalation-rules" && (
          <ServiceSettingsCRUD
            modelName="escalationRule"
            title="Escalation Rule"
            fields={[
              { id: "name", label: "Rule Name", type: "text", required: true },
              { id: "categoryId", label: "Category", type: "select", required: true, options: refData.categories || [] },
              { id: "priorityId", label: "Priority", type: "select", required: true, options: refData.priorities || [] },
              { id: "thresholdHours", label: "Threshold (Hours)", type: "number", required: true },
              { id: "triggerCondition", label: "Trigger Condition (e.g., SinceCreation)", type: "text", required: true },
              { id: "notifyTeamId", label: "Notify Team", type: "select", options: refData.teams || [] },
            ]}
          />
        )}
      </div>
    </div>
  );
}
