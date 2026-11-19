import { loadHabits } from "@/lib/server/habits";
import { HabitsBoard } from "@/components/shared/habits-board";

export const metadata = { title: "Habits" };

export default async function HabitsPage() {
  const data = await loadHabits("habits");
  return (
    <HabitsBoard module="habits" title="Habits" description="Build consistency with daily, weekly and custom habits" {...data}
      templates={[
        { name: "Drink water", kind: "measurable", unit: "glasses", target_value: 8, frequency: "daily", category: "Health" },
        { name: "Read", kind: "measurable", unit: "pages", target_value: 10, frequency: "daily", category: "Growth" },
        { name: "Exercise", kind: "binary", target_value: 1, frequency: "weekly", times_per_week: 3, category: "Health" },
        { name: "Sleep before 23:00", kind: "binary", target_value: 1, frequency: "daily", category: "Health" },
      ]} />
  );
}
