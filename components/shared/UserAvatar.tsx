"use client";

import React from "react";
import { cn } from "@/lib/ui-utils";
import { getInitials, getAvatarColor } from "@/lib/ui-utils";

interface UserAvatarProps {
  name: string;
  company?: string;
  role?: string;
  size?: "sm" | "md" | "lg";
  showCompany?: boolean;
  showRole?: boolean;
  className?: string;
}

export function UserAvatar({ 
  name, 
  company, 
  role, 
  size = "md", 
  showCompany = false, 
  showRole = false,
  className 
}: UserAvatarProps) {
  const initials = getInitials(name);
  const avatarColor = getAvatarColor(name);
  
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
  };
  
  const displayName = name.length > 20 ? `${name.substring(0, 20)}...` : name;
  const displayCompany = company && company.length > 25 ? `${company.substring(0, 25)}...` : company;
  
  return (
    <div className={cn("flex items-center gap-2", className)} title={`${name}${company ? ` • ${company}` : ""}${role ? ` • ${role}` : ""}`}>
      <div className={cn(
        "rounded-full flex items-center justify-center font-black text-white shrink-0",
        sizeClasses[size],
        avatarColor
      )}>
        {initials}
      </div>
      <div className="min-w-0">
        <div className="font-semibold text-slate-700 truncate">{displayName}</div>
        {(showCompany && company) && (
          <div className="text-xs text-slate-500 truncate">{displayCompany}</div>
        )}
        {(showRole && role) && (
          <div className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 inline-block mt-0.5">
            {role}
          </div>
        )}
      </div>
    </div>
  );
}

// Compact version for inline display (e.g., in grids)
export function CompactUserAvatar({ 
  name, 
  company, 
  role 
}: { 
  name: string; 
  company?: string; 
  role?: string; 
}) {
  const initials = getInitials(name);
  const avatarColor = getAvatarColor(name);
  
  const displayName = name.length > 15 ? `${name.substring(0, 15)}...` : name;
  
  return (
    <div className="flex items-center gap-2" title={`${name}${company ? ` • ${company}` : ""}${role ? ` • ${role}` : ""}`}>
      <div className={cn(
        "w-6 h-6 rounded-full flex items-center justify-center font-black text-white text-[10px] shrink-0",
        avatarColor
      )}>
        {initials}
      </div>
      <span className="text-sm font-medium text-slate-700 truncate">{displayName}</span>
      {role && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
          {role}
        </span>
      )}
    </div>
  );
}
