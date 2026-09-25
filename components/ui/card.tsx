import type { HTMLAttributes } from "react";
import styles from "./card.module.css";

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <article className={[styles.card, className].filter(Boolean).join(" ")} {...props} />;
}
