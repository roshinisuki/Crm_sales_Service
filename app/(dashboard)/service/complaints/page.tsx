"use client";

import React, { useState } from "react";
import { serviceModulesConfig } from "@/lib/config/serviceModuleConfig";
import ServiceModuleListPage from "@/components/shared/ServiceModuleListPage";
import ServiceModuleDetailPage from "@/components/shared/ServiceModuleDetailPage";
import ServiceModuleForm from "@/components/shared/ServiceModuleForm";

import { mockComplaints } from "@/lib/config/serviceSeedMockData";

export default function ServiceComplaintsPage() {
  const config = serviceModulesConfig.complaints;
  const [data, setData] = useState<any[]>(mockComplaints);
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleStatusTransition = (newStatus: string) => {
    if (selectedRow) {
      const updatedRow = { ...selectedRow, status: newStatus };
      setData(prev => prev.map(item => item.id === selectedRow.id ? updatedRow : item));
      setSelectedRow(updatedRow);
    }
  };

  const handleCreateNew = (formData: any) => {
    const newComplaint = {
      id: `comp-${data.length + 1}`,
      complaintCode: `COMP-2026-00${data.length + 1}`,
      details: formData.details,
      status: "New",
      severity: "Medium",
      createdAt: new Date().toISOString(),
      customer: { name: "Apex Engineering Solutions" },
      complaintType: { name: "General Issue" },
      asset: { productName: "Unspecified" },
    };
    setData(prev => [newComplaint, ...prev]);
    setIsFormOpen(false);
  };

  if (selectedRow) {
    return (
      <ServiceModuleDetailPage 
        config={config} 
        data={selectedRow} 
        onBack={() => setSelectedRow(null)}
        onStatusTransition={handleStatusTransition}
        onTriggerAction={(actionId) => alert(`Action triggered: ${actionId}`)}
      />
    );
  }

  if (isFormOpen) {
    return (
      <div className="py-6">
        <ServiceModuleForm 
          config={config} 
          onCancel={() => setIsFormOpen(false)} 
          onSubmit={handleCreateNew}
          relationsData={{
            Customer: [{ value: "cust-1", label: "Aero Engine Corp" }],
            CustomerAsset: [{ value: "asset-1", label: "Pneumatic Valve Module X-100" }],
            ComplaintType: [{ value: "ct-1", label: "Safety Issue" }],
            PriorityLevel: [{ value: "pri-high", label: "High" }],
          }}
        />
      </div>
    );
  }

  return (
    <ServiceModuleListPage 
      config={config} 
      data={data} 
      loading={false}
      onRefresh={() => {}}
      onCreateNew={() => setIsFormOpen(true)}
      onRowClick={(row) => setSelectedRow(row)}
    />
  );
}
