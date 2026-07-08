"use client";

import React, { useState } from "react";
import { serviceModulesConfig } from "@/lib/config/serviceModuleConfig";
import ServiceModuleListPage from "@/components/shared/ServiceModuleListPage";
import ServiceModuleDetailPage from "@/components/shared/ServiceModuleDetailPage";
import ServiceModuleForm from "@/components/shared/ServiceModuleForm";
import { VisitSchedulerPanel } from "@/components/shared/ServiceComponents";

import { mockVisits } from "@/lib/config/serviceSeedMockData";

export default function ServiceVisitsPage() {
  const config = serviceModulesConfig.visits;
  const [data, setData] = useState<any[]>(mockVisits);
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
    const newVisit = {
      id: `visit-${data.length + 1}`,
      visitDate: new Date(formData.visitDate).toISOString(),
      status: "Scheduled",
      notes: formData.notes,
      customer: { name: "Apex Engineering Solutions" },
      engineer: { user: { name: "Ramesh Sharma" } }
    };
    setData(prev => [newVisit, ...prev]);
    setIsFormOpen(false);
  };

  const handleSchedulerSchedule = (date: Date, notes: string) => {
    const newVisit = {
      id: `visit-${data.length + 1}`,
      visitDate: date.toISOString(),
      status: "Scheduled",
      notes: notes,
      customer: { name: "Apex Engineering Solutions" },
      engineer: { user: { name: "Ramesh Sharma" } }
    };
    setData(prev => [newVisit, ...prev]);
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
            Customer: [{ value: "cust-1", label: "Vertex Manufacturing Corp" }, { value: "cust-2", label: "Apex Engineering Solutions" }],
            ServiceEngineer: [{ value: "eng-1", label: "Suresh Patel" }, { value: "eng-2", label: "Ramesh Sharma" }],
          }}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <ServiceModuleListPage 
          config={config} 
          data={data} 
          loading={false}
          onRefresh={() => {}}
          onCreateNew={() => setIsFormOpen(true)}
          onRowClick={(row) => setSelectedRow(row)}
        />
      </div>
      <div>
        <VisitSchedulerPanel onSchedule={handleSchedulerSchedule} />
      </div>
    </div>
  );
}
