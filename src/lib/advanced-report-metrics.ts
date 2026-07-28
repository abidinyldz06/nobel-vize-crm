export type PaymentAgingRow = { label: string; count: number; amount: number };

const agingOrder = ["0-7 gün", "8-30 gün", "31-60 gün", "60+ gün"];

export function summarizePaymentAging(
  payments: Array<{ amount: number; status: string | null; created_at: string }>,
  now: Date,
): PaymentAgingRow[] {
  const buckets = new Map<string, PaymentAgingRow>();
  for (const payment of payments) {
    if (payment.status !== "bekliyor") continue;
    const days = Math.max(0, Math.floor((now.getTime() - new Date(payment.created_at).getTime()) / 86_400_000));
    const label = days <= 7 ? "0-7 gün" : days <= 30 ? "8-30 gün" : days <= 60 ? "31-60 gün" : "60+ gün";
    const item = buckets.get(label) ?? { label, count: 0, amount: 0 };
    item.count += 1;
    item.amount += Number(payment.amount);
    buckets.set(label, item);
  }
  return agingOrder.map((label) => buckets.get(label) ?? { label, count: 0, amount: 0 });
}

export function summarizeLeadSla(
  leads: Array<{ status: string; follow_up_due_at: string | null }>,
  now: Date,
) {
  const active = leads.filter((lead) => !["converted", "lost", "unqualified"].includes(lead.status));
  return active.reduce((summary, lead) => {
    if (!lead.follow_up_due_at) return summary;
    const due = new Date(lead.follow_up_due_at).getTime();
    if (due < now.getTime()) summary.overdue += 1;
    else if (due <= now.getTime() + 86_400_000) summary.dueSoon += 1;
    return summary;
  }, { open: active.length, overdue: 0, dueSoon: 0 });
}
