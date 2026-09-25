"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { format, subMonths } from "date-fns";
import Link from "next/link";
import type { CSSProperties } from "react";
import { DashboardIcon } from "@/components/dashboard-icon";
import styles from "./transactions.module.css";

interface Transaction {
  id: number;
  description: string | null;
  normalizedDesc: string | null;
  amount: number | string;
  type: string;
  transactionDate: string;
  transactionTime: string | null;
  category: { id: number; name: string; color: string | null } | null;
  merchant: { id: number; name: string } | null;
  classification: "ESSENTIAL" | "USEFUL" | "DISCRETIONARY" | "CUSTOM" | null;
}

interface Filters {
  month: string;
  category: string;
  merchant: string;
  type: string;
  minAmount: string;
  maxAmount: string;
  search: string;
}

interface Category { id: number; name: string; type: string }

function TransactionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [updateError, setUpdateError] = useState("");
  const currentMonth = format(new Date(), "yyyy-MM");

  const [filters, setFilters] = useState<Filters>({
    month: searchParams.get("month") || currentMonth,
    category: searchParams.get("category") || "",
    merchant: searchParams.get("merchant") || "",
    type: searchParams.get("type") || "",
    minAmount: searchParams.get("minAmount") || "",
    maxAmount: searchParams.get("maxAmount") || "",
    search: searchParams.get("search") || "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
        ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
      });
      const response = await fetch(`/api/transactions?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions);
        setTotalCount(data.total);
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch("/api/categories");
      if (response.ok) setCategories(await response.json());
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    fetchCategories();
  }, [fetchData, fetchCategories]);

  const handleFilterChange = (key: keyof Filters, value: string) => {
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    setPage(1);
    const params = new URLSearchParams();
    Object.entries(nextFilters).forEach(([filterKey, filterValue]) => {
      if (filterValue) params.set(filterKey, filterValue);
    });
    router.push(`/transactions?${params.toString()}`, { scroll: false });
  };

  const handleCategoryChange = async (transactionId: number, categoryId: number | null) => {
    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId }),
      });
      if (response.ok) {
        const updatedTransaction = await response.json();
        setTransactions((previous) => previous.map((transaction) =>
          transaction.id === transactionId ? { ...transaction, category: updatedTransaction.category } : transaction,
        ));
      }
    } catch (error) {
      console.error("Failed to update category:", error);
    }
    setEditingId(null);
  };

  const handleClassificationChange = async (transactionId: number, classification: Transaction["classification"]) => {
    setUpdateError("");
    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classification }),
      });
      if (!response.ok) throw new Error("Could not update classification");
      setTransactions((current) => current.map((transaction) =>
        transaction.id === transactionId ? { ...transaction, classification } : transaction,
      ));
    } catch {
      setUpdateError("Could not save the classification. Try again.");
    }
  };

  const clearFilters = () => {
    const nextFilters: Filters = {
      month: currentMonth,
      category: "",
      merchant: "",
      type: "",
      minAmount: "",
      maxAmount: "",
      search: "",
    };
    setFilters(nextFilters);
    setPage(1);
    router.push("/transactions", { scroll: false });
  };

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => key === "month" ? value !== currentMonth : Boolean(value));
  const monthOptions = Array.from({ length: 36 }, (_, index) => {
    const date = subMonths(new Date(), index);
    return { value: format(date, "yyyy-MM"), label: format(date, "MMMM yyyy") };
  });

  return (
    <div className={styles.page} data-transactions-page="true">
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}><span /> YOUR ACTIVITY</p>
          <h1>Transactions</h1>
          <p><strong>{totalCount.toLocaleString("en-IN")} transactions</strong><span> · Track and manage your money</span></p>
        </div>
        <Link href="/imports" className={styles.importButton}><DashboardIcon name="import" size={17} />Import statement</Link>
      </header>

      <section className={styles.filters} aria-label="Filter transactions">
        <div className={styles.filterTopRow}>
          <label className={`${styles.searchField} ${styles.field}`}>
            <DashboardIcon name="search" size={20} />
            <span className={styles.visuallyHidden}>Search transactions</span>
            <input type="search" placeholder="Search transactions..." value={filters.search} onChange={(event) => handleFilterChange("search", event.target.value)} />
          </label>
          <label className={`${styles.selectField} ${styles.field}`}>
            <DashboardIcon name="calendar" size={19} />
            <span className={styles.visuallyHidden}>Month</span>
            <select value={filters.month} onChange={(event) => handleFilterChange("month", event.target.value)}>
              {monthOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <span className={styles.selectArrow} />
          </label>
          <label className={`${styles.selectField} ${styles.field}`}>
            <DashboardIcon name="categories" size={18} />
            <span className={styles.visuallyHidden}>Category</span>
            <select value={filters.category} onChange={(event) => handleFilterChange("category", event.target.value)}>
              <option value="">All Categories</option>
              {categories.map((category) => <option key={category.id} value={category.id.toString()}>{category.name}</option>)}
            </select>
            <span className={styles.selectArrow} />
          </label>
          <label className={`${styles.selectField} ${styles.field}`}>
            <DashboardIcon name="rules" size={18} />
            <span className={styles.visuallyHidden}>Transaction type</span>
            <select value={filters.type} onChange={(event) => handleFilterChange("type", event.target.value)}>
              <option value="">All Types</option>
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
              <option value="TRANSFER">Transfer</option>
            </select>
            <span className={styles.selectArrow} />
          </label>
        </div>
        <div className={styles.filterBottomRow}>
          <div className={styles.amountRange}>
            <label><span className={styles.visuallyHidden}>Minimum amount</span><input type="number" min="0" placeholder="Min amount" value={filters.minAmount} onChange={(event) => handleFilterChange("minAmount", event.target.value)} /></label>
            <span>to</span>
            <label><span className={styles.visuallyHidden}>Maximum amount</span><input type="number" min="0" placeholder="Max amount" value={filters.maxAmount} onChange={(event) => handleFilterChange("maxAmount", event.target.value)} /></label>
          </div>
          {hasActiveFilters && <button type="button" onClick={clearFilters} className={styles.clearButton}>Clear filters</button>}
        </div>
      </section>

      {updateError && <p role="alert" className={styles.error}>{updateError}</p>}

      <section className={styles.tablePanel} aria-label="Transactions">
        {loading ? (
          <div className={styles.loading} aria-label="Loading transactions"><span /><span /><span /></div>
        ) : transactions.length === 0 ? (
          <div className={styles.emptyState}>
            <span><DashboardIcon name="transactions" size={25} /></span>
            <h2>No transactions found</h2>
            <p>Try changing your filters or import a statement to add activity.</p>
            {hasActiveFilters && <button type="button" onClick={clearFilters} className={styles.clearButton}>Clear filters</button>}
          </div>
        ) : (
          <>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Date <span>↕</span></th><th>Merchant <span>↕</span></th><th>Category <span>↕</span></th><th>Classification</th><th className={styles.amountHead}>Amount <span>↕</span></th><th>Type</th><th><span className={styles.visuallyHidden}>Details</span></th></tr>
                </thead>
                <tbody>
                  {transactions.map((transaction, index) => {
                    const merchantName = transaction.merchant?.name || transaction.normalizedDesc || transaction.description || "Transaction";
                    const date = new Date(transaction.transactionDate);
                    const color = transaction.category?.color && /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(transaction.category.color)
                      ? transaction.category.color
                      : ["#ec395a", "#8c6cec", "#38a9e4", "#ed8a46", "#36bd8a"][index % 5];
                    const amountPrefix = transaction.type === "EXPENSE" ? "−" : transaction.type === "INCOME" ? "+" : "";

                    return (
                      <tr key={transaction.id}>
                        <td className={styles.dateCell}><span>{format(date, "MMM d, yyyy")}</span><small>{transaction.transactionTime ? format(new Date(transaction.transactionTime), "h:mm a") : format(date, "h:mm a")}</small></td>
                        <td>
                          <Link href={`/transactions/${transaction.id}`} className={styles.merchantCell}>
                            <span className={styles.merchantAvatar} style={{ backgroundColor: color }}>{merchantName.slice(0, 1).toUpperCase()}</span>
                            <span className={styles.merchantText}><strong>{merchantName}</strong><small>{transaction.description && transaction.description !== merchantName ? transaction.description : "View transaction details"}</small></span>
                          </Link>
                        </td>
                        <td>
                          {editingId === transaction.id ? (
                            <div className={styles.editCategory}>
                              <select aria-label={`Select category for ${merchantName}`} value={selectedCategoryId ?? ""} onChange={(event) => setSelectedCategoryId(event.target.value ? Number(event.target.value) : null)}>
                                <option value="">Uncategorized</option>
                                {categories.filter((category) => category.type === transaction.type).map((category) => <option key={category.id} value={category.id.toString()}>{category.name}</option>)}
                              </select>
                              <button type="button" onClick={() => void handleCategoryChange(transaction.id, selectedCategoryId)}>Save</button>
                              <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                            </div>
                          ) : (
                            <div className={styles.categoryCell}>
                              <span className={styles.categoryPill} style={{ "--pill-color": color } as CSSProperties}><i />{transaction.category?.name || "Uncategorized"}</span>
                              <button type="button" onClick={() => { setEditingId(transaction.id); setSelectedCategoryId(transaction.category?.id ?? null); }} className={styles.editButton}>Edit</button>
                            </div>
                          )}
                        </td>
                        <td>
                          <label className={styles.visuallyHidden} htmlFor={`classification-${transaction.id}`}>Classify {merchantName}</label>
                          <select id={`classification-${transaction.id}`} value={transaction.classification || ""} onChange={(event) => void handleClassificationChange(transaction.id, (event.target.value || null) as Transaction["classification"])} className={styles.classificationSelect}>
                            <option value="">Unclassified</option>
                            <option value="ESSENTIAL">Essential</option>
                            <option value="USEFUL">Useful</option>
                            <option value="DISCRETIONARY">Discretionary</option>
                            <option value="CUSTOM">Custom</option>
                          </select>
                        </td>
                        <td className={styles.amountCell}>{amountPrefix}{transaction.type === "TRANSFER" ? "" : "₹"}{Number(transaction.amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                        <td><span className={`${styles.typePill} ${transaction.type === "INCOME" ? styles.income : transaction.type === "TRANSFER" ? styles.transfer : styles.expense}`}>{transaction.type}</span></td>
                        <td><Link href={`/transactions/${transaction.id}`} className={styles.detailsLink} aria-label={`Open ${merchantName} transaction`} title="Open transaction"><span /></Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <footer className={styles.tableFooter}>
              <p>Showing {transactions.length} of {totalCount.toLocaleString("en-IN")} transactions</p>
              <div>
                <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>Previous</button>
                <span>Page {page}</span>
                <button type="button" onClick={() => setPage((current) => current + 1)} disabled={transactions.length < 50}>Next</button>
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className={styles.page} data-transactions-page="true"><div className={styles.skeletonHeader} /><div className={styles.skeletonTable} /></div>}>
      <TransactionsContent />
    </Suspense>
  );
}
