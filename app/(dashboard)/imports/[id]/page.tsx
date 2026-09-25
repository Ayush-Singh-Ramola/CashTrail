"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Transaction {
  id: number;
  description: string;
  normalizedDesc: string | null;
  amount: number;
  type: string;
  transactionDate: string;
  category: { id: number; name: string; color: string | null } | null;
  merchant: { id: number; name: string } | null;
}

interface ImportData {
  id: number;
  fileName: string;
  transactionCount: number;
  income: number;
  spent: number;
  transactions: Transaction[];
}

export default function ImportReviewPage() {
  const params = useParams();
  const [data, setData] = useState<ImportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [categories, setCategories] = useState<{ id: number; name: string; color: string | null }[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/imports/${params.id}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error("Failed to fetch import:", error);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/categories");
      if (res.ok) {
        const json = await res.json();
        setCategories(json);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    fetchCategories();
  }, [params.id, fetchData, fetchCategories]);

  const handleCategoryChange = async (transactionId: number, categoryId: number) => {
    try {
      const res = await fetch(`/api/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId }),
      });
      if (res.ok) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                transactions: prev.transactions.map((t) =>
                  t.id === transactionId ? { ...t, category: categories.find((c) => c.id === categoryId) || null } : t
                ),
              }
            : null
        );
      }
    } catch (error) {
      console.error("Failed to update category:", error);
    }
    setEditingId(null);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900">Import not found</h1>
        <Link href="/imports" className="text-blue-600 hover:underline mt-4 inline-block">
          Back to imports
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Review Import</h1>
          <p className="text-gray-500 mt-1">{data.fileName} • {data.transactionCount} transactions</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-green-50 rounded-lg border border-green-100">
          <p className="text-sm text-gray-500">Money Received</p>
          <p className="text-2xl font-bold text-green-600">₹{data.income.toLocaleString("en-IN")}</p>
        </div>
        <div className="p-4 bg-red-50 rounded-lg border border-red-100">
          <p className="text-sm text-gray-500">Money Spent</p>
          <p className="text-2xl font-bold text-red-600">₹{data.spent.toLocaleString("en-IN")}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Merchant</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Category</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.transactions.map((txn) => (
                <tr key={txn.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {new Date(txn.transactionDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{txn.merchant?.name || txn.normalizedDesc || txn.description}</div>
                    <div className="text-sm text-gray-500">{txn.description}</div>
                  </td>
                  <td className="px-4 py-3">
                    {editingId === txn.id ? (
                      <select
                        value={selectedCategoryId || ""}
                        onChange={(e) => setSelectedCategoryId(parseInt(e.target.value))}
                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select category</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id} style={{ borderLeft: `3px solid ${cat.color || "#3B82F6"}` }}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center gap-2">
                        {txn.category && (
                          <span
                            className="px-2 py-1 text-xs font-medium rounded-full text-white"
                            style={{ backgroundColor: txn.category.color || "#3B82F6" }}
                          >
                            {txn.category.name}
                          </span>
                        )}
                        {!txn.category && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                            Uncategorized
                          </span>
                        )}
                        <button
                          onClick={() => {
                            setEditingId(txn.id);
                            setSelectedCategoryId(txn.category?.id || 0);
                          }}
                          className="text-blue-600 hover:text-blue-500 text-sm"
                        >
                          Change
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {txn.type === "EXPENSE" ? "−" : "+"}₹{txn.amount.toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editingId && (
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
            <button
              onClick={() => setEditingId(null)}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={() => handleCategoryChange(editingId, selectedCategoryId!)}
              disabled={!selectedCategoryId}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-4">
        <Link
          href="/dashboard"
          className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 text-center transition-colors"
        >
          View Report
        </Link>
        <Link
          href="/imports"
          className="flex-1 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 text-center transition-colors"
        >
          Import Another
        </Link>
      </div>
    </div>
  );
}
