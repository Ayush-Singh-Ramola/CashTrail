"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";

function subMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() - months);
  return d;
}

interface ComparisonData {
  month1: { year: number; month: number; name: string; total: number };
  month2: { year: number; month: number; name: string; total: number };
  comparison: Array<{
    category: string;
    month1: number;
    month2: number;
    change: number;
    changePercent: number;
  }>;
  biggestIncrease: { category: string; change: number } | null;
  biggestDecrease: { category: string; change: number } | null;
}

export default function ComparePage() {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [month1, setMonth1] = useState(() => format(subMonths(new Date(), 1), "yyyy-MM"));
  const [month2, setMonth2] = useState(() => format(new Date(), "yyyy-MM"));

  const fetchComparison = useCallback(async () => {
    setLoading(true);
    try {
      const [y1, m1] = month1.split("-").map(Number);
      const [y2, m2] = month2.split("-").map(Number);
      const res = await fetch(`/api/analytics/compare?y1=${y1}&m1=${m1}&y2=${y2}&m2=${m2}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error("Failed to fetch comparison:", error);
    } finally {
      setLoading(false);
    }
  }, [month1, month2]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchComparison();
  }, [fetchComparison]);

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Month Comparison</h1>
          <p className="text-gray-500 mt-1">Compare spending across two months</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Month</label>
              <select
                value={month1}
                onChange={(e) => setMonth1(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const date = new Date(2024, i, 1);
                  const value = format(date, "yyyy-MM");
                  return <option key={value} value={value}>{format(date, "MMMM yyyy")}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Second Month</label>
              <select
                value={month2}
                onChange={(e) => setMonth2(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const date = new Date(2024, i, 1);
                  const value = format(date, "yyyy-MM");
                  return <option key={value} value={value}>{format(date, "MMMM yyyy")}</option>;
                })}
              </select>
            </div>
          </div>

          <button
            onClick={fetchComparison}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Comparing..." : "Compare"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Month Comparison</h1>
        <p className="text-gray-500 mt-1">
          {data.month1.name} vs {data.month2.name}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <p className="text-sm text-gray-500">{data.month1.name}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">₹{data.month1.total.toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <p className="text-sm text-gray-500">{data.month2.name}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">₹{data.month2.total.toLocaleString("en-IN")}</p>
        </div>
      </div>

      {data.biggestIncrease && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-700 font-medium">Biggest Increase</p>
          <p className="text-lg font-bold text-red-600 mt-1">
            {data.biggestIncrease.category}: +₹{data.biggestIncrease.change.toLocaleString("en-IN")}
          </p>
        </div>
      )}

      {data.biggestDecrease && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm text-green-700 font-medium">Biggest Decrease</p>
          <p className="text-lg font-bold text-green-600 mt-1">
            {data.biggestDecrease.category}: −₹{Math.abs(data.biggestDecrease.change).toLocaleString("en-IN")}
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Category</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">{data.month1.name}</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">{data.month2.name}</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Change</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">% Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.comparison.map((row) => (
              <tr key={row.category} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-700">{row.category}</td>
                <td className="px-4 py-3 text-right text-sm text-gray-700">₹{row.month1.toLocaleString("en-IN")}</td>
                <td className="px-4 py-3 text-right text-sm text-gray-700">₹{row.month2.toLocaleString("en-IN")}</td>
                <td className="px-4 py-3 text-right text-sm font-medium">
                  {row.change >= 0 ? "+" : ""}₹{row.change.toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-3 text-right text-sm font-medium">
                  {row.changePercent >= 0 ? (
                    <span className="text-red-600">+{row.changePercent.toFixed(1)}%</span>
                  ) : (
                    <span className="text-green-600">{row.changePercent.toFixed(1)}%</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
