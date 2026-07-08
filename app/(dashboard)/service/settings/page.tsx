"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import ServiceSettingsCRUD from "@/components/shared/ServiceSettingsCRUD";
import { 
  FolderKey, AlertOctagon, HelpCircle, Flame, 
  BarChart, Users, Settings, Wrench, HardDrive 
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
  | "assets";

export default function ServiceSettingsPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get("tab");
  const [activeTab, setActiveTab] = useState<SettingKey>("categories");

  useEffect(() => {
    if (tabParam && ["categories", "complaints", "defects", "priorities", "statuses", "teams", "engineers", "assets"].includes(tabParam)) {
      setActiveTab(tabParam as SettingKey);
    }
  }, [tabParam]);

  const tabs: { key: SettingKey; label: string; icon: React.ReactNode }[] = [
    { key: "categories", label: "Service Categories", icon: <FolderKey size={15} /> },
    { key: "complaints", label: "Complaint Types", icon: <AlertOctagon size={15} /> },
    { key: "defects", label: "Defect Types", icon: <HelpCircle size={15} /> },
    { key: "priorities", label: "Priority Levels", icon: <Flame size={15} /> },
    { key: "statuses", label: "Service Statuses", icon: <BarChart size={15} /> },
    { key: "teams", label: "Service Teams", icon: <Users size={15} /> },
    { key: "engineers", label: "Service Engineers", icon: <Wrench size={15} /> },
    { key: "assets", label: "Customer Assets", icon: <HardDrive size={15} /> },
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
              { id: "managerId", label: "Manager User ID", type: "text" },
            ]}
          />
        )}

        {activeTab === "engineers" && (
          <ServiceSettingsCRUD
            modelName="serviceEngineer"
            title="Service Engineer"
            fields={[
              { id: "userId", label: "User ID", type: "text", required: true },
              { id: "teamId", label: "Team ID", type: "text", required: true },
              { id: "specialization", label: "Specialization Areas", type: "text" },
            ]}
          />
        )}

        {activeTab === "assets" && (
          <ServiceSettingsCRUD
            modelName="customerAsset"
            title="Customer Asset"
            fields={[
              { id: "customerId", label: "Customer ID", type: "text", required: true },
              { id: "serialNumber", label: "Serial Number", type: "text", required: true },
              { id: "productName", label: "Product/Model Name", type: "text", required: true },
              { id: "purchaseDate", label: "Purchase Date", type: "date" },
              { id: "warrantyExpiryDate", label: "Warranty Expiry Date", type: "date" },
              { id: "amcExpiryDate", label: "AMC Expiry Date", type: "date" },
            ]}
          />
        )}
      </div>
    </div>
  );
}
