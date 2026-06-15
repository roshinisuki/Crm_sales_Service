import React from 'react';

export default function PageContainer({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`flex flex-col w-full max-w-full overflow-x-hidden ${className}`}>
      {children}
    </div>
  );
}
