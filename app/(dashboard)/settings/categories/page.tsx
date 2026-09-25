"use client";

import { FormEvent, useEffect, useState } from "react";

type Classification = "ESSENTIAL" | "USEFUL" | "DISCRETIONARY" | "CUSTOM" | "";
interface Category { id: number; name: string; type: "INCOME" | "EXPENSE" | "TRANSFER"; color: string | null; icon: string | null; classification: Classification | null; isSystem: boolean }

export default function CategoriesSettingsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<Category["type"]>("EXPENSE");
  const [classification, setClassification] = useState<Classification>("");
  const [color, setColor] = useState("#55735d");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const response = await fetch("/api/categories");
      if (!response.ok) throw new Error("Could not load categories");
      setCategories(await response.json());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not load categories");
    } finally { setLoading(false); }
  };

  useEffect(() => { void Promise.resolve().then(load); }, []);

  const reset = () => { setEditing(null); setName(""); setType("EXPENSE"); setClassification(""); setColor("#55735d"); };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(editing ? `/api/categories/${editing}` : "/api/categories", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, classification: classification || null, color }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not save category");
      reset();
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save category");
    } finally { setSaving(false); }
  };

  const beginEdit = (category: Category) => {
    setEditing(category.id); setName(category.name); setType(category.type);
    setClassification(category.classification ?? ""); setColor(category.color ?? "#55735d");
  };

  const remove = async (category: Category) => {
    if (!window.confirm(`Delete “${category.name}”? Categories with assigned transactions cannot be deleted.`)) return;
    setError("");
    try {
      const response = await fetch(`/api/categories/${category.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete category");
      await load();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not delete category"); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header><h1 className="text-3xl font-bold text-gray-900">Categories</h1><p className="mt-1 text-gray-500">Manage the categories used to group your transactions.</p></header>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <form onSubmit={save} className="grid gap-4 rounded-xl border border-gray-200 bg-white p-5 sm:grid-cols-2">
        <h2 className="sm:col-span-2 font-semibold text-gray-900">{editing ? "Edit category" : "Add category"}</h2>
        <label className="text-sm text-gray-700">Name<input required maxLength={40} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
        <label className="text-sm text-gray-700">Transaction type<select value={type} onChange={(event) => setType(event.target.value as Category["type"])} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"><option value="EXPENSE">Expense</option><option value="INCOME">Income</option><option value="TRANSFER">Transfer</option></select></label>
        <label className="text-sm text-gray-700">Your classification<select value={classification} onChange={(event) => setClassification(event.target.value as Classification)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"><option value="">Leave unclassified</option><option value="ESSENTIAL">Essential</option><option value="USEFUL">Useful</option><option value="DISCRETIONARY">Discretionary</option><option value="CUSTOM">Custom</option></select></label>
        <label className="text-sm text-gray-700">Color<input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="mt-1 block h-10 w-full rounded border border-gray-300 p-1" /></label>
        <div className="flex gap-2 sm:col-span-2"><button disabled={saving} className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? "Saving…" : editing ? "Save changes" : "Create category"}</button>{editing && <button type="button" onClick={reset} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Cancel</button>}</div>
      </form>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <h2 className="border-b border-gray-200 p-5 font-semibold text-gray-900">Your categories</h2>
        {loading ? <p className="p-6 text-sm text-gray-500">Loading…</p> : categories.length === 0 ? <p className="p-6 text-sm text-gray-500">No categories yet.</p> : (
          <ul className="divide-y divide-gray-100">{categories.map((category) => <li key={category.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="flex items-center gap-3"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color ?? "#94a3b8" }} /><div><p className="font-medium text-gray-900">{category.name}{category.isSystem && <span className="ml-2 text-xs text-gray-400">Default</span>}</p><p className="text-xs text-gray-500">{category.type.toLowerCase()} · {category.classification?.toLowerCase() ?? "unclassified"}</p></div></div><div className="flex gap-3"><button onClick={() => beginEdit(category)} className="text-sm font-medium text-emerald-800 hover:underline">Edit</button>{!category.isSystem && <button onClick={() => void remove(category)} className="text-sm font-medium text-red-700 hover:underline">Delete</button>}</div></li>)}</ul>
        )}
      </section>
    </div>
  );
}
