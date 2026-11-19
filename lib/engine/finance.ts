// Finance engine. All amounts are positive; `kind` decides the sign.
//  net = income − expenses; savings rate = net / income (null when there is no income);
//  budget utilisation = spent in budgeted expense categories / sum of those budgets.
export interface TxLike { occurred_on: string; kind: string; amount: number; category_id: string | null }
export interface CategoryLike { id: string; name: string; kind: string; color: string; monthly_budget: number | null }

export interface MonthSummary {
  income: number;
  expenses: number;
  net: number;
  savingsRate: number | null;
  budgetTotal: number;
  budgetSpent: number;
  budgetUtilization: number | null;
  byCategory: { id: string | null; name: string; color: string; spent: number; budget: number | null; utilization: number | null }[];
}

export function summarize(txs: TxLike[], categories: CategoryLike[], from: string, to: string): MonthSummary {
  const inRange = txs.filter((t) => t.occurred_on >= from && t.occurred_on <= to);
  const income = round2(inRange.filter((t) => t.kind === "income").reduce((a, t) => a + Number(t.amount), 0));
  const expenses = round2(inRange.filter((t) => t.kind === "expense").reduce((a, t) => a + Number(t.amount), 0));
  const net = round2(income - expenses);
  const spentBy = new Map<string | null, number>();
  for (const t of inRange) if (t.kind === "expense") spentBy.set(t.category_id, (spentBy.get(t.category_id) ?? 0) + Number(t.amount));

  const byCategory: MonthSummary["byCategory"] = categories
    .filter((c) => c.kind === "expense")
    .map((c) => {
      const spent = round2(spentBy.get(c.id) ?? 0);
      const budget = c.monthly_budget ? Number(c.monthly_budget) : null;
      return { id: c.id, name: c.name, color: c.color, spent, budget, utilization: budget ? (spent / budget) * 100 : null };
    });
  const uncategorised = spentBy.get(null);
  if (uncategorised) byCategory.push({ id: null, name: "Uncategorised", color: "#94a3b8", spent: round2(uncategorised), budget: null, utilization: null });

  const budgeted = byCategory.filter((c) => c.budget);
  const budgetTotal = round2(budgeted.reduce((a, c) => a + (c.budget ?? 0), 0));
  const budgetSpent = round2(budgeted.reduce((a, c) => a + c.spent, 0));
  return {
    income,
    expenses,
    net,
    savingsRate: income > 0 ? (net / income) * 100 : null,
    budgetTotal,
    budgetSpent,
    budgetUtilization: budgetTotal > 0 ? (budgetSpent / budgetTotal) * 100 : null,
    byCategory: byCategory.sort((a, b) => b.spent - a.spent),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
