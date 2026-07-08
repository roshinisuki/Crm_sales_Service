"use client";

import React, { useState } from "react";
import { serviceModulesConfig } from "@/lib/config/serviceModuleConfig";
import ServiceModuleListPage from "@/components/shared/ServiceModuleListPage";
import ServiceModuleDetailPage from "@/components/shared/ServiceModuleDetailPage";
import ServiceModuleForm from "@/components/shared/ServiceModuleForm";

import { mockRequests } from "@/lib/config/serviceSeedMockData";

export default function ServiceRequestsPage() {
  const config = serviceModulesConfig.requests;
  const [data, setData] = useState<any[]>(mockRequests);
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
    const newRequest = {
      id: `req-${data.length + 1}`,
      requestCode: `REQ-2026-00${data.length + 1}`,
      title: formData.title,
      description: formData.description,
      status: "New",
      priority: "Medium",
      priorityId: formData.priorityId || "pri-med",
      categoryId: formData.categoryId,
      createdAt: new Date().toISOString(),
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      customer: { name: "New Lead Customer" },
      asset: { productName: "Standard Equipment S100" },
      team: { name: "Unassigned" },
      engineer: { user: { name: "Unassigned" } },
    };
    setData(prev => [newRequest, ...prev]);
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
            Customer: [{ value: "cust-1", label: "Apex Engineering Solutions" }],
            CustomerAsset: [{ value: "asset-1", label: "Heavy Duty Air Compressor v4" }],
            PriorityLevel: [{ value: "pri-crit", label: "Critical" }, { value: "pri-high", label: "High" }],
            ServiceCategory: [{ value: "cat-mech", label: "Mechanical" }],
            ServiceTeam: [{ value: "team-1", label: "Mechanical Field Team" }],
            ServiceEngineer: [{ value: "eng-1", label: "Ramesh Sharma" }],
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
