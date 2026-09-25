"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ImportsPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<"upload" | "processing" | "review" | "done">("upload");
  const [progress, setProgress] = useState(0);
  const [importId, setImportId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    transactionCount: number;
    income: number;
    spent: number;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!/\.(csv|pdf)$/i.test(selected.name)) {
        setError("Choose a CSV or supported text-based PDF statement.");
        return;
      }
      if (selected.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB");
        return;
      }
      setFile(selected);
      setError("");
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setStage("processing");
    setProgress(0);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/imports", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setImportId(String(data.importId));
      await showImportResult(String(data.importId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStage("upload");
    }
  };

  const showImportResult = async (id: string) => {
    setProgress(100);
    try {
      const res = await fetch(`/api/imports/${id}`);
      const data = await res.json();

      if (res.ok) {
        setResult({
          transactionCount: data.transactionCount,
          income: data.income,
          spent: data.spent,
        });
        setStage("done");
      } else {
        throw new Error(data.error || "Processing failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed");
      setStage("upload");
    }
  };

  const handleReview = () => {
    if (importId) {
      router.push(`/imports/${importId}`);
    }
  };

  const handleViewReport = () => {
    router.push("/dashboard");
  };

  const reset = () => {
    setFile(null);
    setStage("upload");
    setProgress(0);
    setImportId(null);
    setResult(null);
    setError("");
  };

  if (stage === "upload") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Import Transactions</h1>
          <p className="text-gray-500 mt-1">Upload your PhonePe statement to get started</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
              file ? "border-blue-500 bg-blue-50" : "border-gray-300"
            }`}
            onClick={() => document.getElementById("file-input")?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e: React.DragEvent) => {
              e.preventDefault();
              const dropped = e.dataTransfer.files[0];
              if (dropped) handleFileChange({ target: { files: [dropped] } } as unknown as React.ChangeEvent<HTMLInputElement>);
            }}
          >
            <input
              id="file-input"
              type="file"
              accept=".csv,.pdf,text/csv,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="text-5xl mb-4">📄</div>
            <p className="text-lg font-medium text-gray-900 mb-1">
              {file ? file.name : "Drag & drop your statement"}
            </p>
            <p className="text-gray-500">CSV or text-based PDF statement · Max 10MB</p>
            {file && (
              <p className="text-sm text-blue-600 mt-2">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {file && (
            <button
              onClick={handleUpload}
              className="mt-6 w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Upload & Process
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Supported Formats</h3>
          <ul className="space-y-2 text-gray-600 text-sm">
            <li className="flex items-center gap-2">PhonePe CSV export</li>
            <li className="flex items-center gap-2">Bank statement CSV</li>
            <li className="flex items-center gap-2">PDF statements with selectable text and date, description, and amount columns</li>
            <li className="flex items-center gap-2">Scanned image-only PDFs are not supported</li>
          </ul>
        </div>
      </div>
    );
  }

  if (stage === "processing") {
    return (
      <div className="max-w-2xl mx-auto space-y-6 text-center">
        <div className="text-5xl mb-4">⏳</div>
        <h2 className="text-2xl font-bold text-gray-900">Processing your statement</h2>
        <p className="text-gray-500">This usually takes a few seconds</p>

        <div className="w-full bg-gray-200 rounded-full h-3 mt-8">
          <div
            className="bg-blue-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        <p className="text-sm text-gray-500 mt-4">{progress}% complete</p>

        <div className="text-left text-sm text-gray-500 mt-8 space-y-2">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${progress >= 20 ? "bg-green-500" : "bg-gray-300"}`}></span>
            Uploading
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${progress >= 40 ? "bg-green-500" : "bg-gray-300"}`}></span>
            Parsing transactions
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${progress >= 60 ? "bg-green-500" : "bg-gray-300"}`}></span>
            Detecting merchants
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${progress >= 80 ? "bg-green-500" : "bg-gray-300"}`}></span>
            Matching categories
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${progress >= 100 ? "bg-green-500" : "bg-gray-300"}`}></span>
            Saving to database
          </div>
        </div>
      </div>
    );
  }

  if (stage === "done" && result) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-gray-900">Import Complete</h2>
        <p className="text-gray-500">{result.transactionCount} transactions processed</p>

        <div className="grid grid-cols-2 gap-4 mt-8">
          <div className="p-4 bg-green-50 rounded-lg border border-green-100">
            <p className="text-sm text-gray-500">Money Received</p>
            <p className="text-2xl font-bold text-green-600">₹{result.income.toLocaleString("en-IN")}</p>
          </div>
          <div className="p-4 bg-red-50 rounded-lg border border-red-100">
            <p className="text-sm text-gray-500">Money Spent</p>
            <p className="text-2xl font-bold text-red-600">₹{result.spent.toLocaleString("en-IN")}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <button
            onClick={handleReview}
            className="flex-1 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Review Transactions
          </button>
          <button
            onClick={handleViewReport}
            className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            View Report
          </button>
        </div>

        <button
          onClick={reset}
          className="mt-4 text-sm text-gray-500 hover:text-gray-700"
        >
          Import another statement
        </button>
      </div>
    );
  }

  return null;
}
