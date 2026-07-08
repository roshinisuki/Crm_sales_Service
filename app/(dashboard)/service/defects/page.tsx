"use client";

import React, { useState } from "react";
import { serviceModulesConfig } from "@/lib/config/serviceModuleConfig";
import ServiceModuleListPage from "@/components/shared/ServiceModuleListPage";
import ServiceModuleDetailPage from "@/components/shared/ServiceModuleDetailPage";
import ServiceModuleForm from "@/components/shared/ServiceModuleForm";

import { mockDefects } from "@/lib/config/serviceSeedMockData";

export default function ServiceDefectsPage() {
  const config = serviceModulesConfig.defects;
  const [data, setData] = useState<any[]>(mockDefects);
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
    const newDefect = {
      id: `def-${data.length + 1}`,
      defectCode: `DF-2026-00${data.length + 1}`,
      description: formData.description,
      status: "New",
      createdAt: new Date().toISOString(),
      defectType: { name: "General Defect" },
      asset: { productName: "Heavy Duty Air Compressor v4" },
      priority: { name: "Medium" },
      priorityId: formData.priorityId,
      defectTypeId: formData.defectTypeId
    };
    setData(prev => [newDefect, ...prev]);
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
            DefectType: [{ value: "dt-mech", label: "Mechanical Defect" }],
            CustomerAsset: [{ value: "asset-1", label: "Heavy Duty Air Compressor v4" }],
            PriorityLevel: [{ value: "pri-high", label: "High" }, { value: "pri-med", label: "Medium" }],
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
