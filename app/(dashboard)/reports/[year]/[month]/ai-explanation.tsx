"use client";

import { useState } from "react";
import styles from "./ai-explanation.module.css";

export default function AiExplanation({ year, month, configured }: { year: number; month: number; configured: boolean }) {
  const [consented, setConsented] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [explanation, setExplanation] = useState("");

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/ai/explanations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, consent: consented }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not generate an explanation");
      setExplanation(data.explanation);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not generate an explanation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={`${styles.container} rounded-xl p-5`}>
      <div>
        <h2 className="font-semibold text-gray-900">Optional AI explanation</h2>
        <p className="mt-1 text-sm text-gray-600">Your report already includes a calculated summary. AI can add a short plain-language reading.</p>
      </div>
      {!configured ? (
        <p className="mt-3 text-sm text-gray-600">This deployment has not configured an AI provider.</p>
      ) : (
        <>
          <label className="mt-4 flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} className="mt-1" />
            <span>Send this report’s month, category totals, comparison directions, and pattern counts to OpenAI for this request. Raw transaction descriptions and account identifiers are not sent.</span>
          </label>
          <button onClick={generate} disabled={!consented || loading} className="mt-4 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-900 disabled:opacity-50">
            {loading ? "Preparing explanation…" : explanation ? "Generate again" : "Generate explanation"}
          </button>
          {explanation && <p className="mt-4 rounded-lg bg-white p-4 text-sm leading-6 text-gray-800">{explanation}</p>}
          {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        </>
      )}
    </section>
  );
}
