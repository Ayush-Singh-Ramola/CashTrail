"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

interface Merchant { id: number; name: string; rawPatterns: string[]; classification: string | null; defaultCategoryId: number | null; defaultCategory: { id: number; name: string } | null }
interface Category { id: number; name: string; type: string }

export default function MerchantsSettingsPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [patterns, setPatterns] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [classification, setClassification] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [merchantResponse, categoryResponse] = await Promise.all([fetch("/api/merchants"), fetch("/api/categories")]);
      if (!merchantResponse.ok || !categoryResponse.ok) throw new Error("Could not load merchant settings");
      setMerchants(await merchantResponse.json());
      setCategories((await categoryResponse.json()).filter((item: Category) => item.type === "EXPENSE"));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not load merchant settings");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const reset = () => { setEditing(null); setName(""); setPatterns(""); setCategoryId(""); setClassification(""); };
  const beginEdit = (merchant: Merchant) => {
    setEditing(merchant.id); setName(merchant.name); setPatterns(merchant.rawPatterns.join("\n"));
    setCategoryId(merchant.defaultCategoryId?.toString() ?? ""); setClassification(merchant.classification ?? "");
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setError("");
    try {
      const response = await fetch(`/api/merchants/${editing}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          rawPatterns: patterns.split("\n").map((pattern) => pattern.trim()).filter(Boolean),
          defaultCategoryId: categoryId ? Number(categoryId) : null,
          classification: classification || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not save merchant");
      reset();
      await load();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save merchant"); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header><h1 className="text-3xl font-bold text-gray-900">Merchants</h1><p className="mt-1 text-gray-500">Correct merchant names and add matching descriptions for future imports.</p></header>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {editing !== null && (
        <form onSubmit={save} className="grid gap-4 rounded-xl border border-gray-200 bg-white p-5 sm:grid-cols-2">
          <h2 className="font-semibold text-gray-900 sm:col-span-2">Edit merchant</h2>
          <label className="text-sm text-gray-700">Display name<input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
          <label className="text-sm text-gray-700">Default category<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"><option value="">Use category rules</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label className="text-sm text-gray-700">Your classification<select value={classification} onChange={(event) => setClassification(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"><option value="">Use transaction category</option><option value="ESSENTIAL">Essential</option><option value="USEFUL">Useful</option><option value="DISCRETIONARY">Discretionary</option><option value="CUSTOM">Custom</option></select></label>
          <label className="text-sm text-gray-700 sm:col-span-2">Match these statement descriptions (one per line)<textarea rows={4} maxLength={8000} value={patterns} onChange={(event) => setPatterns(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /><span className="mt-1 block text-xs text-gray-500">A description matching any line will use this merchant on future imports.</span></label>
          <div className="flex gap-2 sm:col-span-2"><button className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white">Save changes</button><button type="button" onClick={reset} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Cancel</button></div>
        </form>
      )}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? <p className="p-6 text-sm text-gray-500">Loading…</p> : merchants.length === 0 ? <p className="p-6 text-sm text-gray-500">Merchants appear after you import a statement.</p> : (
          <ul className="divide-y divide-gray-100">{merchants.map((merchant) => <li key={merchant.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0"><p className="font-medium text-gray-900">{merchant.name}</p><p className="mt-1 truncate text-xs text-gray-500">{merchant.rawPatterns.length} saved match{merchant.rawPatterns.length === 1 ? "" : "es"}{merchant.defaultCategory ? ` · ${merchant.defaultCategory.name}` : ""}{merchant.classification ? ` · ${merchant.classification.toLowerCase()}` : ""}</p></div><button onClick={() => beginEdit(merchant)} className="text-sm font-medium text-emerald-800 hover:underline">Correct merchant</button></li>)}</ul>
        )}
      </section>
    </div>
  );
}
