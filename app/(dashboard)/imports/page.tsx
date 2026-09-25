"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { DashboardIcon } from "@/components/dashboard-icon";
import styles from "./imports.module.css";

type ImportResult = {
  transactionCount: number;
  income: number;
  spent: number;
};

function formatRupees(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function UploadArtwork() {
  return (
    <div className={styles.uploadArtwork} aria-hidden="true">
      <span className={styles.storyNote}>Your spending<br />has a story</span>
      <svg className={styles.storyArrow} viewBox="0 0 94 48" fill="none">
        <path d="M2 3c7 26 24 34 54 31" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="m48 26 10 8-11 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className={styles.artCardBack}><span>cash flow</span><i /></div>
      <div className={styles.artCardFront}>
        <span className={styles.artRupee}>₹</span>
        <i /><i />
      </div>
      <span className={styles.artCheck}><DashboardIcon name="check" size={17} strokeWidth={2.8} /></span>
    </div>
  );
}

function FormatArtwork() {
  return (
    <div className={styles.formatArtwork} aria-hidden="true">
      <span className={styles.artSparkOne} />
      <span className={styles.artSparkTwo} />
      <span className={styles.artSparkThree} />
      <div className={`${styles.formatFile} ${styles.phonePeFile}`}>
        <span className={styles.artRupee}>₹</span><i /><i />
      </div>
      <div className={`${styles.formatFile} ${styles.csvFile}`}>
        <span>CSV</span><i />
      </div>
      <div className={`${styles.formatFile} ${styles.pdfFile}`}>
        <span>PDF</span><i />
      </div>
    </div>
  );
}

export default function ImportsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<"upload" | "processing" | "done">("upload");
  const [progress, setProgress] = useState(0);
  const [importId, setImportId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const selectFile = (selected: File) => {
    if (!/\.(csv|pdf)$/i.test(selected.name)) {
      setFile(null);
      setError("Choose a CSV or supported text-based PDF statement.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setFile(null);
      setError("File size must be less than 10MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setFile(selected);
    setError("");
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (selected) selectFile(selected);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped) selectFile(dropped);
  };

  const handleUpload = async () => {
    if (!file) return;

    setStage("processing");
    setProgress(0);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/imports", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Upload failed");

      const id = String(data.importId);
      setImportId(id);
      setProgress(100);

      const resultResponse = await fetch(`/api/imports/${id}`);
      const resultData = await resultResponse.json();
      if (!resultResponse.ok) throw new Error(resultData.error || "Processing failed");

      setResult({
        transactionCount: resultData.transactionCount,
        income: resultData.income,
        spent: resultData.spent,
      });
      setStage("done");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
      setStage("upload");
    }
  };

  const reset = () => {
    setFile(null);
    setStage("upload");
    setProgress(0);
    setImportId(null);
    setResult(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (stage === "upload") {
    return (
      <section className={styles.page} data-import-page="true">
        <header className={styles.pageHeader}>
          <div className={styles.headingCopy}>
            <p className={styles.overline}><DashboardIcon name="pulse" size={19} /> Imports</p>
            <h1>Import <span>Transactions</span></h1>
            <p className={styles.subtitle}>Upload your PhonePe statement to get started</p>
          </div>
          <UploadArtwork />
        </header>

        <label
          className={`${styles.dropPanel}${isDragging ? ` ${styles.dragging}` : ""}${file ? ` ${styles.hasFile}` : ""}`}
          htmlFor="statement-file"
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            const nextTarget = event.relatedTarget;
            if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) setIsDragging(false);
          }}
          onDrop={handleDrop}
          aria-describedby="statement-help"
        >
          <input
            ref={fileInputRef}
            id="statement-file"
            type="file"
            aria-label="Choose a CSV or text-based PDF statement"
            accept=".csv,.pdf,text/csv,application/pdf"
            onChange={handleFileChange}
            className={styles.fileInput}
          />
          <div className={styles.dropInner}>
            <span className={styles.uploadIcon}>
              <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path d="M9 21.5a6 6 0 0 1-.6-12A8 8 0 0 1 23.7 11 5.3 5.3 0 0 1 23 21.5h-2" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 26V15m0 0-4.2 4.2M16 15l4.2 4.2" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h2>{file ? file.name : <>Drag &amp; drop your <span>statement</span></>}</h2>
            <p id="statement-help">CSV or text-based PDF statement <span aria-hidden="true">·</span> Max 10MB</p>
            <div className={styles.formatPills} aria-label="Supported statement types">
              <span><i className={`${styles.pillIcon} ${styles.phonePeIcon}`}>₹</i>PhonePe</span>
              <span><i className={`${styles.pillIcon} ${styles.csvIcon}`}>▤</i>CSV</span>
              <span><i className={`${styles.pillIcon} ${styles.pdfIcon}`}>▣</i>PDF</span>
            </div>
            {file && (
              <p className={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB selected · Click to choose another</p>
            )}
          </div>
        </label>

        {error && <p className={styles.errorMessage} role="alert">{error}</p>}
        {file && (
          <div className={styles.uploadActions}>
            <button type="button" className={styles.clearButton} onClick={reset}>Remove file</button>
            <button type="button" className={styles.uploadButton} onClick={handleUpload}>
              Upload &amp; Process <DashboardIcon name="arrowRight" size={17} />
            </button>
          </div>
        )}

        <section className={styles.supportPanel} aria-labelledby="supported-formats-title">
          <div className={styles.supportIcon}><DashboardIcon name="transactions" size={27} /></div>
          <div className={styles.supportCopy}>
            <h2 id="supported-formats-title">Supported Formats</h2>
            <ul>
              <li><DashboardIcon name="check" size={16} />PhonePe CSV export</li>
              <li><DashboardIcon name="check" size={16} />Bank statement CSV</li>
              <li><DashboardIcon name="check" size={16} />PDF statements with selectable text and date, description, and amount columns</li>
              <li><DashboardIcon name="check" size={16} />Scanned image-only PDFs are not supported</li>
            </ul>
          </div>
          <FormatArtwork />
        </section>
      </section>
    );
  }

  if (stage === "processing") {
    return (
      <section className={`${styles.page} ${styles.statusPage}`} data-import-page="true" aria-live="polite">
        <span className={styles.processingMark} aria-hidden="true"><DashboardIcon name="import" size={27} /></span>
        <p className={styles.overline}>IMPORT IN PROGRESS</p>
        <h1>Processing your statement</h1>
        <p className={styles.subtitle}>This usually takes a few seconds</p>
        <div className={styles.progressTrack}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <p className={styles.progressLabel}>{progress}% complete</p>
        <div className={styles.processingSteps}>
          {["Uploading", "Parsing transactions", "Detecting merchants", "Matching categories", "Saving to your account"].map((step, index) => (
            <p key={step}><i className={progress >= (index + 1) * 20 ? styles.stepComplete : ""} />{step}</p>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={`${styles.page} ${styles.statusPage}`} data-import-page="true">
      <span className={`${styles.processingMark} ${styles.successMark}`} aria-hidden="true"><DashboardIcon name="check" size={28} /></span>
      <p className={styles.overline}>IMPORT COMPLETE</p>
      <h1>Your statement is ready</h1>
      <p className={styles.subtitle}>{result?.transactionCount ?? 0} transactions processed</p>

      <div className={styles.resultGrid}>
        <article><span>Money received</span><strong>{formatRupees(result?.income ?? 0)}</strong></article>
        <article><span>Money spent</span><strong>{formatRupees(result?.spent ?? 0)}</strong></article>
      </div>
      <div className={styles.resultActions}>
        <button type="button" className={styles.secondaryButton} onClick={() => importId && router.push(`/imports/${importId}`)}>Review transactions</button>
        <button type="button" className={styles.uploadButton} onClick={() => router.push("/dashboard")}>View report <DashboardIcon name="arrowRight" size={17} /></button>
      </div>
      <button type="button" className={styles.againButton} onClick={reset}>Import another statement</button>
    </section>
  );
}
