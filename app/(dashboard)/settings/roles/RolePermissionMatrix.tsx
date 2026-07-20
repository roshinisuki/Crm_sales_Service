"use client";

import { useState, useTransition } from "react";
import { updateRolePermission } from "@/app/actions/permissions";
import { Check, X, Loader2 } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { cn } from "@/lib/ui-utils";

type Permission = {
  role: string;
  module: string;
  visible: boolean;
  canDelete: boolean;
};

interface MatrixProps {
  initialPermissions: Permission[];
  modules: string[];
}

export default function RolePermissionMatrix({ initialPermissions, modules }: MatrixProps) {
  const [permissions, setPermissions] = useState<Permission[]>(initialPermissions);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  const getPerm = (role: string, moduleName: string) => {
    return permissions.find(p => p.role === role && p.module === moduleName) || {
      role, module: moduleName, visible: true, canDelete: false
    };
  };

  const handleToggle = (role: string, moduleName: string, field: "visible" | "canDelete", currentValue: boolean) => {
    if (role === "Admin") return; // Admin is locked

    const newValue = !currentValue;

    // Optimistic UI update
    setPermissions(prev => {
      const existingIdx = prev.findIndex(p => p.role === role && p.module === moduleName);
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = { ...copy[existingIdx], [field]: newValue };
        return copy;
      } else {
        return [...prev, { role, module: moduleName, visible: true, canDelete: false, [field]: newValue }];
      }
    });

    startTransition(async () => {
      const result = await updateRolePermission(role, moduleName, field, newValue);
      if (!result.success) {
        toast.error("Failed to update permission");
        // Revert on failure
        setPermissions(initialPermissions);
      } else {
        toast.success(`Permission updated successfully`);
      }
    });
  };

  const roles = ["Admin", "SalesManager", "SalesExecutive", "DemoAdmin"];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 sticky top-0 z-10">
          <tr>
            <th className="px-6 py-4 font-semibold text-gray-900 dark:text-white border-r border-gray-200 dark:border-white/10 min-w-[200px]">
              Module
            </th>
            {roles.map(role => (
              <th key={role} className="px-6 py-4 font-semibold text-center text-gray-900 dark:text-white border-r border-gray-200 dark:border-white/10 last:border-r-0">
                {role}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-white/10">
          {modules.map((moduleName, idx) => (
            <tr key={moduleName} className={cn("hover:bg-gray-50 dark:hover:bg-white/5 transition-colors", idx % 2 === 0 ? "bg-white dark:bg-transparent" : "bg-gray-50/50 dark:bg-white/[0.02]")}>
              <td className="px-6 py-4 font-medium text-gray-900 dark:text-white border-r border-gray-200 dark:border-white/10">
                {moduleName}
              </td>
              {roles.map(role => {
                const isAdmin = role === "Admin";
                const perm = isAdmin ? { visible: true, canDelete: true } : getPerm(role, moduleName);

                return (
                  <td key={`${moduleName}-${role}`} className="px-6 py-4 border-r border-gray-200 dark:border-white/10 last:border-r-0 text-center">
                    <div className="flex items-center justify-center gap-6">
                      {/* Visible Toggle */}
                      <label className={cn("flex flex-col items-center gap-1.5", isAdmin ? "cursor-not-allowed opacity-60" : "cursor-pointer group")}>
                        <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">View</span>
                        <div
                          className={cn(
                            "w-10 h-5 rounded-full relative transition-colors duration-200 ease-in-out",
                            perm.visible ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
                          )}
                          onClick={() => !isAdmin && handleToggle(role, moduleName, "visible", perm.visible)}
                        >
                          <div className={cn(
                            "absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200 flex items-center justify-center",
                            perm.visible ? "translate-x-5" : "translate-x-0"
                          )}>
                            {perm.visible ? <Check size={10} className="text-blue-600" /> : <X size={10} className="text-gray-400" />}
                          </div>
                        </div>
                      </label>

                      {/* Can Delete Toggle */}
                      <label className={cn("flex flex-col items-center gap-1.5", isAdmin ? "cursor-not-allowed opacity-60" : "cursor-pointer group")}>
                        <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">Delete</span>
                        <div
                          className={cn(
                            "w-10 h-5 rounded-full relative transition-colors duration-200 ease-in-out",
                            perm.canDelete ? "bg-red-500" : "bg-gray-300 dark:bg-gray-600"
                          )}
                          onClick={() => !isAdmin && handleToggle(role, moduleName, "canDelete", perm.canDelete)}
                        >
                          <div className={cn(
                            "absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200 flex items-center justify-center",
                            perm.canDelete ? "translate-x-5" : "translate-x-0"
                          )}>
                            {perm.canDelete ? <Check size={10} className="text-red-500" /> : <X size={10} className="text-gray-400" />}
                          </div>
                        </div>
                      </label>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {isPending && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm font-medium">Saving changes...</span>
        </div>
      )}
    </div>
  );
}
