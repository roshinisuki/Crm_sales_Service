export default function ProductsPage() {
  return (
    <div className="flex-1 h-full flex flex-col items-center justify-center text-center p-8 bg-card">
      <div className="w-16 h-16 rounded-2xl bg-page-bg border border-border flex items-center justify-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
          <path d="M16.5 9.4 7.5 4.21" />
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-text-primary">Select a Product</h2>
      <p className="text-sm text-text-muted max-w-sm mt-2">
        Choose a product from the list on the left to view its details, or create a new product to add it to your catalogue.
      </p>
    </div>
  );
}
