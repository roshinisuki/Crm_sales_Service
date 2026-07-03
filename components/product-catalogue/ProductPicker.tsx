"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ToastProvider";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/FormField";
import { cn } from "@/lib/ui-utils";
import { Search, Package, Check, X, Filter } from "lucide-react";

interface Product {
  id: string;
  productCode: string;
  name: string;
  basePrice: number | null;
  category?: { id: string; name: string } | null;
  unit?: string | null;
}

interface ProductPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (product: Product) => void;
  selectedProductId?: string | null;
  categoryId?: string | null;
  title?: string;
  multiple?: boolean;
}

export function ProductPicker({
  isOpen,
  onClose,
  onSelect,
  selectedProductId,
  categoryId,
  title = "Select Product",
  multiple = false,
}: ProductPickerProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState(categoryId || "");
  const toast = useToast();

  const loadProducts = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (filterCategoryId) params.categoryId = filterCategoryId;
      params.isActive = "true";

      const res = await fetch(`/api/catalogue/products?${new URLSearchParams(params)}`);
      const data = await res.json();
      if (data.success && data.data) {
        setProducts(data.data);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await fetch("/api/catalogue/categories?isActive=true");
      const data = await res.json();
      if (data.success && data.data) {
        setCategories(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadProducts();
      loadCategories();
    }
  }, [isOpen, search, filterCategoryId]);

  const handleSelect = (product: Product) => {
    onSelect(product);
    if (!multiple) {
      onClose();
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose} title={title} size="lg">
      <div className="space-y-4">
        {/* Search and Filter */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input
              placeholder="Search products by name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={filterCategoryId}
            onChange={(e) => setFilterCategoryId(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white min-w-[150px]"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Product List */}
        <div className="max-h-[400px] overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading products...</div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No products found</div>
          ) : (
            products.map((product) => {
              const isSelected = selectedProductId === product.id;
              return (
                <button
                  key={product.id}
                  onClick={() => handleSelect(product)}
                  className={cn(
                    "w-full text-left p-4 hover:bg-slate-50 transition-colors flex items-start gap-3",
                    isSelected && "bg-blue-50"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                    isSelected ? "border-blue-500 bg-blue-500" : "border-slate-300"
                  )}>
                    {isSelected && <Check size={14} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-slate-900">{product.name}</span>
                      {product.category && (
                        <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                          {product.category.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span className="font-mono text-xs">{product.productCode}</span>
                      {product.basePrice && (
                        <span>₹{product.basePrice.toLocaleString()}</span>
                      )}
                      {product.unit && (
                        <span>/ {product.unit}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
