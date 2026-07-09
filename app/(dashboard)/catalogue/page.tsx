"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/ui/PageShell";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { FolderTree, Package, FileText, BookOpen, ChevronRight } from "lucide-react";
import { CRMSpinner } from "@/components/CRMSpinner";
import { useCurrency } from "@/components/CurrencyProvider";
import { cn } from "@/lib/ui-utils";

export default function CatalogueLandingPage() {
  const router = useRouter();
  const { formatCurrency } = useCurrency();
  const [counts, setCounts] = useState({ products: 0, categories: 0, datasheets: 0, brochures: 0 });
  const [recentProducts, setRecentProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [prodRes, catRes, dsRes, brRes] = await Promise.all([
          fetch("/api/catalogue/products"),
          fetch("/api/catalogue/categories"),
          fetch("/api/catalogue/datasheets"),
          fetch("/api/catalogue/brochures")
        ]);

        const [prodData, catData, dsData, brData] = await Promise.all([
          prodRes.json(),
          catRes.json(),
          dsRes.json(),
          brRes.json()
        ]);

        const productsList = prodData.data || [];
        setCounts({
          products: productsList.length,
          categories: (catData.data || []).length,
          datasheets: (dsData.data || []).length,
          brochures: (brData.data || []).length
        });
        
        const sortedProds = [...productsList].sort((a: any, b: any) => 
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        setRecentProducts(sortedProds.slice(0, 5));
      } catch (err) {
        console.error("Failed to load catalogue overview data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <PageShell
      title="Product Catalogue"
      subtitle="Overview of your product categories, specifications, and collateral."
    >
      {loading ? null : (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <SummaryCard
              label="Products"
              value={counts.products}
              subtitle="All catalogued products"
              icon={<Package size={20} className="text-blue-500" />}
              variant="blue"
              onClick={() => router.push("/catalogue/products")}
            />
            <SummaryCard
              label="Categories"
              value={counts.categories}
              subtitle="Product classifications"
              icon={<FolderTree size={20} className="text-green-500" />}
              variant="green"
              onClick={() => router.push("/catalogue/categories")}
            />
            <SummaryCard
              label="Datasheets"
              value={counts.datasheets}
              subtitle="Technical documents"
              icon={<FileText size={20} className="text-amber-500" />}
              variant="amber"
              onClick={() => router.push("/catalogue/datasheets")}
            />
            <SummaryCard
              label="Brochures"
              value={counts.brochures}
              subtitle="Marketing collateral"
              icon={<BookOpen size={20} className="text-red-500" />}
              variant="red"
              onClick={() => router.push("/catalogue/brochures")}
            />
          </div>

          {/* Recent Products Table */}
          <div className="crm-card overflow-hidden mt-6">
            <div className="px-4 sm:px-5 py-4 border-b border-theme flex items-center justify-between">
              <h3 className="text-sm font-bold text-theme-primary">Recently Added Products</h3>
              <button 
                onClick={() => router.push("/catalogue/products")} 
                className="text-xs font-semibold text-[var(--primary)] hover:underline flex items-center gap-1"
              >
                View All Products <ChevronRight size={14} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th className="crm-th">Product Name</th>
                    <th className="crm-th">Code</th>
                    <th className="crm-th">Category</th>
                    <th className="crm-th">Base Price</th>
                    <th className="crm-th">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="crm-td text-center py-10 text-theme-muted text-sm">
                        No products catalogued yet.
                      </td>
                    </tr>
                  ) : (
                    recentProducts.map((prod) => (
                      <tr 
                        key={prod.id} 
                        className="crm-tr table-row-clickable"
                        onClick={() => router.push(`/catalogue/products/${prod.id}`)}
                      >
                        <td className="crm-td font-semibold text-theme-primary">{prod.name}</td>
                        <td className="crm-td font-mono text-xs text-theme-secondary">{prod.productCode || "—"}</td>
                        <td className="crm-td text-theme-secondary">{prod.category?.name || "Uncategorized"}</td>
                        <td className="crm-td text-theme-primary font-medium">{prod.basePrice ? formatCurrency(prod.basePrice) : "—"}</td>
                        <td className="crm-td">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            prod.isActive 
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400" 
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          )}>
                            {prod.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
