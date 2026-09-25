"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

interface Transaction { id: number; amount: number | string; type: "INCOME" | "EXPENSE" | "TRANSFER"; description: string | null; transactionDate: string; categoryId: number | null; merchantId: number | null; classification: string | null; notes: string | null; import: { fileName: string; createdAt: string } | null }
interface SelectItem { id: number; name: string }

export default function TransactionDetails({ transactionId }: { transactionId: string }) {
  const router = useRouter();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [categories, setCategories] = useState<SelectItem[]>([]);
  const [merchants, setMerchants] = useState<SelectItem[]>([]);
  const [form, setForm] = useState({ amount: "", type: "EXPENSE" as Transaction["type"], description: "", date: "", categoryId: "", merchantId: "", classification: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [transactionResponse, categoryResponse, merchantResponse] = await Promise.all([
          fetch(`/api/transactions/${transactionId}`), fetch("/api/categories"), fetch("/api/merchants"),
        ]);
        const data = await transactionResponse.json();
        if (!transactionResponse.ok) throw new Error(data.error || "Transaction not found");
        const categoryData = categoryResponse.ok ? await categoryResponse.json() : [];
        const merchantData = merchantResponse.ok ? await merchantResponse.json() : [];
        const current: Transaction = data;
        setTransaction(current);
        setCategories(categoryData);
        setMerchants(merchantData);
        setForm({
          amount: String(Number(current.amount)), type: current.type, description: current.description ?? "",
          date: new Date(current.transactionDate).toISOString().slice(0, 10), categoryId: current.categoryId?.toString() ?? "",
          merchantId: current.merchantId?.toString() ?? "", classification: current.classification ?? "", notes: current.notes ?? "",
        });
      } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not load transaction"); }
      finally { setLoading(false); }
    };
    void load();
  }, [transactionId]);

  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setSaved(false); setError("");
    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(form.amount), type: form.type, description: form.description,
          transactionDate: `${form.date}T00:00:00.000Z`, categoryId: form.categoryId ? Number(form.categoryId) : null,
          merchantId: form.merchantId ? Number(form.merchantId) : null, classification: form.classification || null,
          notes: form.notes || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not save transaction");
      setTransaction((current) => current ? { ...current, ...data } : current);
      setSaved(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save transaction"); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!window.confirm("Delete this transaction? This cannot be undone.")) return;
    setError("");
    try {
      const response = await fetch(`/api/transactions/${transactionId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete transaction");
      router.push("/transactions");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not delete transaction"); }
  };

  if (loading) return <div className="mx-auto max-w-3xl animate-pulse rounded-xl border border-gray-200 bg-white p-8" aria-label="Loading transaction"><div className="h-7 w-1/3 rounded bg-gray-200" /><div className="mt-6 h-64 rounded bg-gray-100" /></div>;
  if (!transaction) return <div className="mx-auto max-w-3xl rounded-xl border border-gray-200 bg-white p-8 text-center"><h1 className="text-xl font-semibold text-gray-900">Transaction not found</h1><Link href="/transactions" className="mt-4 inline-block text-emerald-800 hover:underline">Back to transactions</Link></div>;

  const fieldClass = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100";
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header><Link href="/transactions" className="text-sm font-medium text-emerald-800 hover:underline">← Transactions</Link><h1 className="mt-3 text-3xl font-bold text-gray-900">Transaction details</h1>{transaction.import && <p className="mt-1 text-sm text-gray-500">Imported from {transaction.import.fileName}</p>}</header>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <form onSubmit={save} className="grid gap-4 rounded-xl border border-gray-200 bg-white p-5 sm:grid-cols-2">
        <label className="text-sm text-gray-700">Amount<input type="number" min="0.01" step="0.01" required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className={fieldClass} /></label>
        <label className="text-sm text-gray-700">Type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as Transaction["type"] })} className={fieldClass}><option value="EXPENSE">Expense</option><option value="INCOME">Income</option><option value="TRANSFER">Transfer</option></select></label>
        <label className="text-sm text-gray-700">Date<input type="date" required value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className={fieldClass} /></label>
        <label className="text-sm text-gray-700">Merchant<select value={form.merchantId} onChange={(event) => setForm({ ...form, merchantId: event.target.value })} className={fieldClass}><option value="">No merchant</option>{merchants.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchant.name}</option>)}</select></label>
        <label className="text-sm text-gray-700">Category<select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} className={fieldClass}><option value="">Uncategorized</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label className="text-sm text-gray-700">Your classification<select value={form.classification} onChange={(event) => setForm({ ...form, classification: event.target.value })} className={fieldClass}><option value="">Unclassified</option><option value="ESSENTIAL">Essential</option><option value="USEFUL">Useful</option><option value="DISCRETIONARY">Discretionary</option><option value="CUSTOM">Custom</option></select></label>
        <label className="text-sm text-gray-700 sm:col-span-2">Description<input maxLength={500} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={fieldClass} /></label>
        <label className="text-sm text-gray-700 sm:col-span-2">Private note<textarea rows={3} maxLength={1000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className={fieldClass} /></label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><button disabled={saving} className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? "Saving…" : "Save changes"}</button>{saved && <span role="status" className="text-sm text-emerald-800">Saved</span>}<button type="button" onClick={() => void remove()} className="ml-auto rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">Delete transaction</button></div>
      </form>
    </div>
  );
}
