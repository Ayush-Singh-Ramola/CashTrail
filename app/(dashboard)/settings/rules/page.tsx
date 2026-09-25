"use client";

import { useState, useEffect, useCallback } from "react";

interface Rule {
  id: number;
  pattern: string;
  merchantId: number | null;
  categoryId: number | null;
  classification: string | null;
  priority: number;
  merchant?: { name: string } | null;
  category?: { name: string } | null;
}

interface Category {
  id: number;
  name: string;
}

interface Merchant {
  id: number;
  name: string;
}

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [formData, setFormData] = useState({
    pattern: "",
    merchantId: "",
    categoryId: "",
    classification: "",
    priority: 0,
  });

  const fetchData = useCallback(async () => {
    try {
      const [rulesRes, catsRes, mersRes] = await Promise.all([
        fetch("/api/rules"),
        fetch("/api/categories"),
        fetch("/api/merchants"),
      ]);
      if (rulesRes.ok) setRules(await rulesRes.json());
      if (catsRes.ok) setCategories(await catsRes.json());
      if (mersRes.ok) setMerchants(await mersRes.json());
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      pattern: formData.pattern,
      merchantId: formData.merchantId ? parseInt(formData.merchantId) : null,
      categoryId: formData.categoryId ? parseInt(formData.categoryId) : null,
      classification: formData.classification || null,
      priority: formData.priority,
    };

    try {
      const url = editingRule ? `/api/rules/${editingRule.id}` : "/api/rules";
      const method = editingRule ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        fetchData();
        resetForm();
      }
    } catch (error) {
      console.error("Failed to save rule:", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this rule?")) return;
    try {
      await fetch(`/api/rules/${id}`, { method: "DELETE" });
      fetchData();
    } catch (error) {
      console.error("Failed to delete rule:", error);
    }
  };

  const resetForm = () => {
    setEditingRule(null);
    setShowForm(false);
    setFormData({ pattern: "", merchantId: "", categoryId: "", classification: "", priority: 0 });
  };

  const startEdit = (rule: Rule) => {
    setEditingRule(rule);
    setShowForm(true);
    setFormData({
      pattern: rule.pattern,
      merchantId: rule.merchantId?.toString() || "",
      categoryId: rule.categoryId?.toString() || "",
      classification: rule.classification || "",
      priority: rule.priority,
    });
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Spending Rules</h1>
          <p className="text-gray-500 mt-1">Automatically categorize transactions based on patterns</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Rule
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">{editingRule ? "Edit Rule" : "New Rule"}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pattern (regex or text)</label>
              <input
                type="text"
                value={formData.pattern}
                onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                placeholder="e.g., zomato|swiggy|uber"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Case-insensitive. Matches against merchant name and description.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Merchant (optional)</label>
                <select
                  value={formData.merchantId}
                  onChange={(e) => setFormData({ ...formData, merchantId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Auto-detect</option>
                  {merchants.map((m) => (
                    <option key={m.id} value={m.id.toString()}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category (optional)</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Auto-categorize</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id.toString()}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Classification</label>
                <select
                  value={formData.classification}
                  onChange={(e) => setFormData({ ...formData, classification: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Default</option>
                  <option value="ESSENTIAL">Essential</option>
                  <option value="USEFUL">Useful</option>
                  <option value="DISCRETIONARY">Discretionary</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Higher priority rules are applied first.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Save
              </button>
              <button type="button" onClick={resetForm} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {rules.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No rules yet. Create your first rule to auto-categorize transactions.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {rules.map((rule) => (
              <div key={rule.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">{rule.pattern}</code>
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                      Priority {rule.priority}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                    {rule.merchant && (
                      <span className="flex items-center gap-1">
                        <span className="text-gray-400">🏪</span>
                        {rule.merchant.name}
                      </span>
                    )}
                    {rule.category && (
                      <span className="flex items-center gap-1">
                        <span className="text-gray-400">📂</span>
                        {rule.category.name}
                      </span>
                    )}
                    {rule.classification && (
                      <span className="flex items-center gap-1">
                        <span className="text-gray-400">🏷️</span>
                        {rule.classification}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(rule)}
                    className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="text-red-600 hover:text-red-500 text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}