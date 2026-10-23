import type { Invoice } from "../lib/types";
import { Pill } from "./kit";

export function StatusPill({ inv }: { inv: Invoice }) {
  if (inv.status === "paid") return <Pill text="Paid" tone="good" />;
  if (inv.overdue) return <Pill text="Overdue" tone="bad" />;
  if (inv.acknowledgments.length) return <Pill text="Confirmed by client" tone="accent" />;
  return <Pill text="Waiting for confirmation" tone="warn" />;
}

