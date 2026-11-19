"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Plus, ChevronLeft, ChevronRight, ArrowDownLeft, ArrowUpRight, PiggyBank, Percent, Search, Tags, Pencil } from "lucide-react";
import { PageHeader, StatCard, EmptyState, Tabs, Progress, Badge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { EntityForm, useFormState, type Field } from "@/components/forms/entity-form";
import { BarSeriesChart, BreakdownBars } from "@/components/charts";
import { CURRENCIES } from "@/lib/constants";
import { addMonthsISO, endOfMonthISO, formatDate, todayISO } from "@/lib/dates";
import { summarize } from "@/lib/engine/finance";
import { formatMoney, formatPct } from "@/lib/format";
import { useDb } from "@/lib/hooks/use-db";
import { cn } from "@/lib/utils";
import type { Row } from "@/lib/types";

type Tx = Row<"transactions">;

export function FinanceView({ month, txs, categories, savings, currency }: { month: string; txs: Tx[]; categories: Row<"finance_categories">[]; savings: Row<"savings_goals">[]; currency: string }) {
  const router = useRouter();
  const db = useDb();
  const [tab, setTab] = useState<"overview" | "transactions" | "budgets" | "savings">("overview");
  const [kind, setKind] = useState("all");
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const txForm = useFormState<Tx>();
  const catForm = useFormState<Row<"finance_categories">>();
  const saveForm = useFormState<Row<"savings_goals">>();
  const end = endOfMonthISO(month);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const activeCats = categories.filter((c) => !c.archived_at);

  // Only transactions in the profile currency are summed; others are shown but flagged.
  const sameCur = txs.filter((t) => t.currency === currency);
  const otherCur = txs.filter((t) => t.currency !== currency && t.occurred_on >= month && t.occurred_on <= end).length;
  const s = summarize(sameCur, categories, month, end);
  const go = (m: string) => router.push(`/finance?month=${m.slice(0, 7)}`);
  const months = Array.from({ length: 12 }, (_, i) => addMonthsISO(month, i - 11));
  const trend = months.map((m) => { const x = summarize(sameCur, categories, m, endOfMonthISO(m)); return { month: formatDate(m, { month: "short" }), income: x.income, expenses: x.expenses }; });
  const monthTx = txs.filter((t) => t.occurred_on >= month && t.occurred_on <= end);
  const filtered = monthTx.filter((t) => (kind === "all" || t.kind === kind) && (!cat || t.category_id === cat) && (!q || `${t.description ?? ""} ${t.note ?? ""}`.toLowerCase().includes(q.toLowerCase())));
  const money = (n: number) => formatMoney(n, currency);
  const isCurrent = month.slice(0, 7) === todayISO().slice(0, 7);

  const txFields: Field[] = [
    { name: "kind", label: "Type", type: "select", required: true, options: [{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }] },
    { name: "amount", label: "Amount", type: "number", min: 0.01, step: 0.01, required: true },
    { name: "occurred_on", label: "Date", type: "date", required: true },
    { name: "currency", label: "Currency", type: "select", required: true, options: CURRENCIES.map((c) => ({ value: c, label: c })) },
    { name: "category_id", label: "Category", type: "select", options: activeCats.map((c) => ({ value: c.id, label: `${c.kind === "income" ? "↙" : "↗"} ${c.name}` })) },
    { name: "description", label: "Description" },
    { name: "note", label: "Note", type: "textarea" },
  ];
  const catFields: Field[] = [
    { name: "name", label: "Name", required: true },
    { name: "kind", label: "Type", type: "select", required: true, options: [{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }] },
    { name: "monthly_budget", label: `Monthly budget (${currency})`, type: "number", min: 0, showIf: (v) => v.kind === "expense" },
    { name: "color", label: "Color", type: "color" },
  ];
  const saveFields: Field[] = [
    { name: "name", label: "Goal", required: true },
    { name: "target_amount", label: `Target (${currency})`, type: "number", min: 0.01, required: true },
    { name: "current_amount", label: `Saved so far (${currency})`, type: "number", min: 0, required: true },
    { name: "target_date", label: "Target date", type: "date" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  return (
    <div>
      <PageHeader title="Finance" icon={Wallet} description="Income, expenses, budgets and savings"
        actions={<Button onClick={() => txForm.create({ kind: "expense", currency, occurred_on: isCurrent ? todayISO() : month })}><Plus /> Transaction</Button>} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => go(addMonthsISO(month, -1))} aria-label="Previous month"><ChevronLeft /></Button>
          <span className="min-w-36 text-center text-sm font-semibold">{formatDate(month, { month: "long", year: "numeric" })}</span>
          <Button size="icon" variant="outline" onClick={() => go(addMonthsISO(month, 1))} aria-label="Next month"><ChevronRight /></Button>
          {!isCurrent && <Button size="sm" variant="ghost" onClick={() => go(todayISO())}>This month</Button>}
        </div>
        <Tabs value={tab} onChange={setTab} items={[{ value: "overview", label: "Overview" }, { value: "transactions", label: "Transactions", count: monthTx.length }, { value: "budgets", label: "Categories & budgets" }, { value: "savings", label: "Savings goals" }]} />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Income" value={money(s.income)} icon={ArrowDownLeft} tone="var(--success)" />
        <StatCard label="Expenses" value={money(s.expenses)} icon={ArrowUpRight} tone="var(--destructive)" />
        <StatCard label="Net balance" value={<span className={cn(s.net < 0 && "text-destructive")}>{money(s.net)}</span>} />
        <StatCard label="Savings rate" value={formatPct(s.savingsRate)} hint={s.savingsRate === null ? "No income this month" : "net ÷ income"} icon={Percent} />
        <StatCard label="Budget used" value={formatPct(s.budgetUtilization)} hint={s.budgetTotal ? `${money(s.budgetSpent)} of ${money(s.budgetTotal)}` : "No budgets set"} icon={PiggyBank} />
      </div>
      {otherCur > 0 && <p className="-mt-3 mb-4 text-xs text-warning">{otherCur} transaction(s) this month are in another currency and are excluded from totals (no exchange rates are applied).</p>}

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader><div><CardTitle>Income vs expenses</CardTitle><CardDescription>Last 12 months ({currency})</CardDescription></div></CardHeader>
            <CardContent>{trend.some((t) => t.income || t.expenses) ? <BarSeriesChart data={trend} xKey="month" series={[{ key: "income", label: "Income", color: "var(--series-3)" }, { key: "expenses", label: "Expenses", color: "var(--series-2)" }]} format={money} /> : <EmptyState icon={Wallet} title="No transactions yet" />}</CardContent>
          </Card>
          <Card>
            <CardHeader><div><CardTitle>Spending by category</CardTitle><CardDescription>{formatDate(month, { month: "long" })}</CardDescription></div></CardHeader>
            <CardContent>{s.expenses ? <BreakdownBars items={s.byCategory.filter((c) => c.spent > 0).map((c) => ({ label: c.name, value: c.spent, color: c.color, hint: formatPct((c.spent / s.expenses) * 100) }))} format={money} /> : <EmptyState icon={ArrowUpRight} title="No expenses this month" />}</CardContent>
          </Card>
          <Card>
            <CardHeader><div><CardTitle>Budgets</CardTitle><CardDescription>Spent vs monthly budget</CardDescription></div></CardHeader>
            <CardContent className="space-y-3">
              {s.byCategory.filter((c) => c.budget).length ? s.byCategory.filter((c) => c.budget).map((c) => (
                <div key={c.id ?? c.name}>
                  <div className="mb-1 flex justify-between text-xs"><span>{c.name}</span><span className={cn("tabular-nums", (c.utilization ?? 0) > 100 ? "text-destructive" : "text-muted-foreground")}>{money(c.spent)} / {money(c.budget!)}</span></div>
                  <Progress value={c.utilization} color={(c.utilization ?? 0) > 100 ? "var(--destructive)" : (c.utilization ?? 0) > 80 ? "var(--warning)" : c.color} />
                </div>
              )) : <EmptyState icon={PiggyBank} title="No budgets yet" description="Set monthly budgets on expense categories." action={<Button size="sm" variant="outline" onClick={() => setTab("budgets")}>Set budgets</Button>} />}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "transactions" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="w-48 pl-8" /></div>
            <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-32"><option value="all">All</option><option value="income">Income</option><option value="expense">Expenses</option></Select>
            <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-44"><option value="">All categories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          </div>
          {filtered.length ? (
            <Card className="divide-y divide-border">
              {filtered.map((t) => {
                const c = t.category_id ? catById.get(t.category_id) : null;
                return (
                  <button key={t.id} onClick={() => txForm.edit(t)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full" style={{ background: `${c?.color ?? "#94a3b8"}22`, color: c?.color ?? "#94a3b8" }}>{t.kind === "income" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm">{t.description || c?.name || "Transaction"}</span><span className="text-xs text-muted-foreground">{formatDate(t.occurred_on, { weekday: "short", month: "short", day: "numeric" })}{c ? ` · ${c.name}` : ""}{t.note ? ` · ${t.note}` : ""}</span></span>
                    <span className={cn("shrink-0 text-sm font-semibold tabular-nums", t.kind === "income" ? "text-success" : "")}>{t.kind === "income" ? "+" : "−"}{formatMoney(Number(t.amount), t.currency)}</span>
                  </button>
                );
              })}
            </Card>
          ) : <EmptyState icon={Wallet} title="No transactions match" />}
        </div>
      )}

      {tab === "budgets" && (
        <div className="space-y-3">
          <div className="flex justify-end"><Button variant="outline" onClick={() => catForm.create({ kind: "expense", color: "#64748b" })}><Tags /> New category</Button></div>
          <div className="grid gap-4 md:grid-cols-2">
            {(["expense", "income"] as const).map((k) => (
              <Card key={k}>
                <CardHeader><CardTitle>{k === "expense" ? "Expense categories" : "Income categories"}</CardTitle></CardHeader>
                <CardContent className="divide-y divide-border">
                  {categories.filter((c) => c.kind === k).map((c) => (
                    <button key={c.id} onClick={() => catForm.edit(c)} className={cn("flex w-full items-center justify-between py-2 text-left text-sm hover:text-primary", c.archived_at && "opacity-50")}>
                      <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: c.color }} />{c.name}{c.archived_at && <Badge>archived</Badge>}</span>
                      <span className="text-xs text-muted-foreground">{c.monthly_budget ? `${money(Number(c.monthly_budget))} / month` : k === "expense" ? "No budget" : ""}</span>
                    </button>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === "savings" && (
        <div className="space-y-3">
          <div className="flex justify-end"><Button variant="outline" onClick={() => saveForm.create({ current_amount: 0 })}><Plus /> Savings goal</Button></div>
          {savings.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {savings.map((g) => {
                const pct = (Number(g.current_amount) / Number(g.target_amount)) * 100;
                return (
                  <Card key={g.id}>
                    <CardHeader>
                      <div><CardTitle>{g.name}</CardTitle><CardDescription>{g.target_date ? `by ${formatDate(g.target_date, { month: "short", day: "numeric", year: "numeric" })}` : "No deadline"}</CardDescription></div>
                      <Button size="icon" variant="ghost" onClick={() => saveForm.edit(g)} aria-label="Edit"><Pencil /></Button>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm"><span className="font-semibold tabular-nums">{money(Number(g.current_amount))}</span><span className="text-muted-foreground tabular-nums">of {money(Number(g.target_amount))}</span></div>
                      <Progress value={pct} color="var(--series-3)" />
                      <QuickDeposit goal={g} onDeposit={(amt) => db.update("savings_goals", g.id, { current_amount: Math.max(0, Number(g.current_amount) + amt) }, "Savings updated")} />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : <EmptyState icon={PiggyBank} title="No savings goals" description="Emergency fund, travel, a new laptop…" />}
        </div>
      )}

      <EntityForm table="transactions" title={txForm.record ? "Edit transaction" : "New transaction"} fields={txFields} open={txForm.open} onClose={txForm.close} record={txForm.record} defaults={txForm.defaults}
        transform={(v) => {
          const c = v.category_id ? catById.get(v.category_id as string) : null;
          return { ...v, category_id: c && c.kind !== v.kind ? null : v.category_id };
        }} />
      <EntityForm table="finance_categories" title={catForm.record ? "Edit category" : "New category"} fields={catFields} open={catForm.open} onClose={catForm.close} record={catForm.record} defaults={catForm.defaults}
        transform={(v) => ({ ...v, monthly_budget: v.kind === "expense" ? v.monthly_budget : null })} />
      <EntityForm table="savings_goals" title={saveForm.record ? "Edit savings goal" : "New savings goal"} fields={saveFields} open={saveForm.open} onClose={saveForm.close} record={saveForm.record} defaults={saveForm.defaults} />
    </div>
  );
}

function QuickDeposit({ goal, onDeposit }: { goal: Row<"savings_goals">; onDeposit: (amount: number) => void }) {
  const [v, setV] = useState("");
  return (
    <form className="flex gap-2 pt-1" onSubmit={(e) => { e.preventDefault(); const n = Number(v); if (n) { onDeposit(n); setV(""); } }}>
      <Input type="number" step="0.01" placeholder="Add (or −withdraw)" value={v} onChange={(e) => setV(e.target.value)} className="h-8" aria-label={`Deposit to ${goal.name}`} />
      <Button type="submit" size="sm" variant="outline">Update</Button>
    </form>
  );
}
