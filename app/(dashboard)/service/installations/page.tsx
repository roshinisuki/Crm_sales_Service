"use client";

import React, { useState } from "react";
import { serviceModulesConfig } from "@/lib/config/serviceModuleConfig";
import ServiceModuleListPage from "@/components/shared/ServiceModuleListPage";
import ServiceModuleDetailPage from "@/components/shared/ServiceModuleDetailPage";
import ServiceModuleForm from "@/components/shared/ServiceModuleForm";

import { mockInstallations } from "@/lib/config/serviceSeedMockData";

export default function ServiceInstallationsPage() {
  const config = serviceModulesConfig.installations;
  const [data, setData] = useState<any[]>(mockInstallations);
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
    const newInst = {
      id: `inst-${data.length + 1}`,
      installationCode: `COMM-2026-00${data.length + 1}`,
      status: "Scheduled",
      createdAt: new Date().toISOString(),
      notes: formData.notes,
      customer: { name: "Apex Engineering Solutions" },
      asset: { productName: "Heavy Duty Air Compressor v4" },
      team: { name: "Mechanical Field Team" },
      engineer: { user: { name: "Unassigned" } }
    };
    setData(prev => [newInst, ...prev]);
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
