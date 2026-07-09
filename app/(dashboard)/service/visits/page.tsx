"use client";

import React, { useState } from "react";
import { serviceModulesConfig } from "@/lib/config/serviceModuleConfig";
import ServiceModuleListPage from "@/components/shared/ServiceModuleListPage";
import ServiceModuleDetailPage from "@/components/shared/ServiceModuleDetailPage";
import ServiceModuleForm from "@/components/shared/ServiceModuleForm";
import { VisitSchedulerPanel } from "@/components/shared/ServiceComponents";

export default function ServiceVisitsPage() {
  const config = serviceModulesConfig.visits;
  const [data, setData] = useState<any[]>([]);
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refData, setRefData] = useState<any>({});

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/service/visits');
      if (res.ok) {
        const json = await res.json();
        const mappedData = json.map((item: any) => {
          // Identify the parent record for customer display
          const parent = item.request || item.complaint || item.defect || item.installation;
          return {
            ...item,
            visitCode: `VST-${item.id.substring(0, 8).toUpperCase()}`,
            visitDate: item.scheduledDate,
            customer: { name: parent?.customer?.name || "Unknown" },
            engineer: { user: { name: item.engineer?.user?.name || "Unassigned" } },
            status: item.status?.name || "Unknown",
          };
        });
        setData(mappedData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchRefData = async () => {
    try {
      const res = await fetch('/api/service/reference-data?module=visit'); // or standard if no specific statuses
      if (res.ok) {
        setRefData(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  React.useEffect(() => {
    fetchData();
    fetchRefData();
  }, []);

  const handleStatusTransition = async (newStatusName: string) => {
    if (selectedRow) {
      const newStatusObj = refData.ServiceStatus?.find((s: any) => s.label === newStatusName);
      if (!newStatusObj) return;

      try {
        const res = await fetch(`/api/service/visits/${selectedRow.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ statusId: newStatusObj.value }),
        });
        if (res.ok) {
          await fetchData();
          setSelectedRow(null);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleCreateNew = async (formData: any) => {
    try {
      const createdById = "user-1";

      const res = await fetch('/api/service/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title || "New Visit",
          notes: formData.notes,
          statusId: formData.statusId || refData.ServiceStatus?.[0]?.value,
          engineerId: formData.engineerId || refData.ServiceEngineer?.[0]?.value,
          scheduledDate: formData.visitDate || new Date().toISOString(),
          requestId: formData.requestId,
          complaintId: formData.complaintId,
          defectId: formData.defectId,
          installationId: formData.installationId,
          createdById,
        }),
      });

      if (res.ok) {
        await fetchData();
        setIsFormOpen(false);
      } else {
        const err = await res.json();
        alert(`Failed to create: ${err.error || "Unknown error"}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSchedulerSchedule = async (date: Date, notes: string) => {
    try {
      const createdById = "user-1";

      const res = await fetch('/api/service/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: "Scheduled from Panel",
          notes: notes,
          statusId: refData.ServiceStatus?.[0]?.value,
          engineerId: refData.ServiceEngineer?.[0]?.value,
          scheduledDate: date.toISOString(),
          createdById,
        }),
      });

      if (res.ok) {
        await fetchData();
      } else {
        const err = await res.json();
        alert(`Failed to schedule: ${err.error || "Unknown error"}`);
      }
    } catch (e) {
      console.error(e);
    }
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
          relationsData={refData}
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
          loading={loading}
          onRefresh={fetchData}
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
