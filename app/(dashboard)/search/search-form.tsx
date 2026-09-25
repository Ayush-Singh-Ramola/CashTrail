"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface SearchResult {
  id: number;
  description: string | null;
  amount: number | string;
  type: string;
  transactionDate: string;
  category: { name: string } | null;
  merchant: { name: string } | null;
}

interface SearchResponse {
  interpretation: string;
  total: number;
  transactions: SearchResult[];
}

export default function NaturalSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const runSearch = async (value: string) => {
    if (!value.trim()) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(value.trim())}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Search failed");
      setResult(payload);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Search failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery) void Promise.resolve().then(() => runSearch(initialQuery));
    // Initial query is only read when the route loads; submissions are handled by the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = query.trim();
    if (value) router.push(`/search?q=${encodeURIComponent(value)}`, { scroll: false });
    void runSearch(value);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">Search transactions</h1>
        <p className="mt-1 text-gray-500">Ask in plain language, such as “food spending over ₹500 last month”.</p>
      </header>

      <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 sm:flex-row">
        <label className="sr-only" htmlFor="natural-search">Search your transactions</label>
        <input
          id="natural-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={200}
          placeholder="Try: subscriptions in March 2026"
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        <button disabled={loading || !query.trim()} className="rounded-lg bg-blue-700 px-6 py-3 font-medium text-white hover:bg-blue-800 disabled:opacity-50">
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {result && (
        <section aria-live="polite" className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900">{result.interpretation}</h2>
            <p className="mt-1 text-sm text-gray-500">{result.total} matching transactions{result.total > result.transactions.length ? " (showing the 50 most recent)" : ""}</p>
          </div>
          {result.transactions.length === 0 ? (
            <p className="p-8 text-center text-gray-500">No matching transactions. Try a broader search.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {result.transactions.map((transaction) => (
                <li key={transaction.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900">{transaction.merchant?.name || transaction.description || "Transaction"}</p>
                    <p className="text-sm text-gray-500">{new Date(transaction.transactionDate).toLocaleDateString("en-IN")} · {transaction.category?.name || "Uncategorized"}</p>
                  </div>
                  <p className={`font-semibold ${transaction.type === "INCOME" ? "text-green-700" : "text-gray-900"}`}>
                    {transaction.type === "INCOME" ? "+" : "−"}₹{Number(transaction.amount).toLocaleString("en-IN")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
