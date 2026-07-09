import React from "react";

interface SectionCardHeaderProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBgColor?: string;
  iconTextColor?: string;
}

export function SectionCardHeader({
  title,
  subtitle,
  icon,
  iconBgColor = "bg-purple-50 dark:bg-purple-950/30",
  iconTextColor = "text-purple-600 dark:text-purple-400"
}: SectionCardHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${iconBgColor} ${iconTextColor} shrink-0`}>
        {icon}
      </div>
      <div>
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</h3>
        <p className="text-xs text-[var(--text-tertiary)]">{subtitle}</p>
      </div>
    </div>
  );
}
