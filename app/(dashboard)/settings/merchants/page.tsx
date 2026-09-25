"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DashboardIcon } from "@/components/dashboard-icon";
import styles from "./merchants.module.css";

interface Merchant {
  id: number;
  name: string;
  rawPatterns: string[];
  classification: string | null;
  defaultCategoryId: number | null;
  defaultCategory: { id: number; name: string } | null;
}

interface Category {
  id: number;
  name: string;
  type: string;
}

const classificationOptions = [
  { value: "ESSENTIAL", label: "Essential" },
  { value: "USEFUL", label: "Useful" },
  { value: "DISCRETIONARY", label: "Discretionary" },
  { value: "CUSTOM", label: "Custom" },
];

export default function MerchantsSettingsPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [patterns, setPatterns] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [classification, setClassification] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [merchantResponse, categoryResponse] = await Promise.all([
        fetch("/api/merchants"),
        fetch("/api/categories"),
      ]);
      if (!merchantResponse.ok || !categoryResponse.ok) throw new Error("Could not load merchant settings");
      setMerchants(await merchantResponse.json());
      setCategories((await categoryResponse.json()).filter((item: Category) => item.type === "EXPENSE"));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not load merchant settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const filteredMerchants = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return merchants.filter((merchant) => {
      const matchesFilter = filter === "ALL" || merchant.classification === filter;
      const searchable = [
        merchant.name,
        merchant.defaultCategory?.name ?? "",
        ...merchant.rawPatterns,
      ].join(" ").toLocaleLowerCase();
      return matchesFilter && (!query || searchable.includes(query));
    });
  }, [filter, merchants, search]);

  const reset = () => {
    setEditing(null);
    setName("");
    setPatterns("");
    setCategoryId("");
    setClassification("");
  };

  const beginEdit = (merchant: Merchant) => {
    setEditing(merchant.id);
    setName(merchant.name);
    setPatterns(merchant.rawPatterns.join("\n"));
    setCategoryId(merchant.defaultCategoryId?.toString() ?? "");
    setClassification(merchant.classification ?? "");
    setError("");
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (editing === null) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/merchants/" + editing, {
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
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save merchant");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className={styles.page} data-merchant-page="true">
      <header className={styles.pageHeader}>
        <div className={styles.titleGroup}>
          <span className={styles.titleIcon}><DashboardIcon name="merchants" size={27} /></span>
          <div>
            <h1>Merchants</h1>
            <p>Correct merchant names and add matching descriptions for future imports.</p>
          </div>
        </div>
        <div className={styles.controls}>
          <label className={styles.searchBox}>
            <DashboardIcon name="search" size={19} />
            <span className={styles.visuallyHidden}>Search merchants</span>
            <input
              type="search"
              placeholder="Search merchants..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className={styles.filterBox}>
            <DashboardIcon name="filter" size={18} />
            <span className={styles.visuallyHidden}>Filter by classification</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="ALL">All</option>
              {classificationOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <DashboardIcon name="chevron" size={16} />
          </label>
        </div>
      </header>

      {error && <p role="alert" className={styles.errorNotice}>{error}</p>}

      {editing !== null && (
        <Card className={styles.editorCard} id="merchant-editor">
          <div className={styles.editorHeading}>
            <div>
              <p className={styles.editorEyebrow}>MERCHANT DETAILS</p>
              <h2>Correct merchant</h2>
              <p>Changes will apply to future imported transactions.</p>
            </div>
            <button className={styles.closeEditor} type="button" onClick={reset} aria-label="Close editor">
              <DashboardIcon name="chevron" size={18} />
            </button>
          </div>
          <form onSubmit={save} className={styles.editorForm}>
            <label>
              <span>Display name</span>
              <input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>
              <span>Default category</span>
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">Use category rules</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Your classification</span>
              <select value={classification} onChange={(event) => setClassification(event.target.value)}>
                <option value="">Use transaction category</option>
                {classificationOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className={styles.patternField}>
              <span>Statement descriptions to match</span>
              <textarea
                rows={4}
                maxLength={8000}
                value={patterns}
                onChange={(event) => setPatterns(event.target.value)}
                aria-describedby="pattern-help"
              />
              <small id="pattern-help">Add one description per line. Matching descriptions will use this merchant on future imports.</small>
            </label>
            <div className={styles.editorActions}>
              <button className={styles.saveButton} type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button className={styles.cancelButton} type="button" onClick={reset} disabled={saving}>Cancel</button>
            </div>
          </form>
        </Card>
      )}

      <Card className={styles.merchantList}>
        {loading ? (
          <div className={styles.listMessage}>Loading merchants…</div>
        ) : filteredMerchants.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}><DashboardIcon name="merchants" size={21} /></span>
            <strong>{merchants.length === 0 ? "No merchants yet" : "No matching merchants"}</strong>
            <p>{merchants.length === 0 ? "Merchants will appear here after you import a statement." : "Try a different search or classification filter."}</p>
          </div>
        ) : (
          <ul className={styles.merchantRows}>
            {filteredMerchants.map((merchant, index) => (
              <li className={styles.merchantRow} key={merchant.id}>
                <span className={styles.merchantMark} data-tone={index % 7} aria-hidden="true">
                  {merchant.name.trim().charAt(0).toLocaleUpperCase() || <DashboardIcon name="merchants" size={22} />}
                </span>
                <span className={styles.merchantDetails}>
                  <strong>{merchant.name}</strong>
                  <small>{merchant.rawPatterns.length} saved match{merchant.rawPatterns.length === 1 ? "" : "es"}</small>
                </span>
                <button
                  className={styles.merchantAction}
                  type="button"
                  onClick={() => beginEdit(merchant)}
                  aria-expanded={editing === merchant.id}
                  aria-controls={editing === merchant.id ? "merchant-editor" : undefined}
                >
                  <Badge variant="success" className={styles.correctBadge}>
                    <DashboardIcon name="check" size={14} />
                    Correct merchant
                  </Badge>
                  <DashboardIcon name="chevron" size={17} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
