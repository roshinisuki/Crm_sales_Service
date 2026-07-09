"use client";

import { CRMSpinner } from "./CRMSpinner";

interface PageLoaderProps {
  label?: string;
}

export function PageLoader({ label = "Loading..." }: PageLoaderProps) {
  return (
    <div className="flex items-center justify-center min-h-[70vh] w-full p-4">
      <CRMSpinner size={48} label={label} />
    </div>
  );
}

export default PageLoader;
