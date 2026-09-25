import type { HTMLAttributes } from "react";
import styles from "./badge.module.css";

export type BadgeVariant = "default" | "success" | "info" | "danger";

export function Badge({ variant = "default", className, ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  const variantClass = variant === "success" ? styles.success : variant === "info" ? styles.info : variant === "danger" ? styles.danger : styles.default;
  return <span className={[styles.badge, variantClass, className].filter(Boolean).join(" ")} {...props} />;
}
