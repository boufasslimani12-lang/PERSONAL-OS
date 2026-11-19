import { loadHabits } from "@/lib/server/habits";
import { HabitsBoard } from "@/components/shared/habits-board";

export const metadata = { title: "Religion" };

// Religious practices reuse the habit engine (module = "religion"). Nothing is pre-created:
// the quick-start list is optional and every target is editable.
export default async function ReligionPage() {
  const data = await loadHabits("religion");
  return (
    <HabitsBoard module="religion" title="Religion" description="Prayer, Quran, adhkar and personal practices — your targets, your routine" {...data}
      defaultAreaKey="religion" categoryLabel="Type"
      templates={[
        { name: "Daily prayers", kind: "measurable", unit: "prayers", target_value: 5, frequency: "daily", category: "Prayer" },
        { name: "Quran reading", kind: "measurable", unit: "pages", target_value: 4, frequency: "daily", category: "Quran" },
        { name: "Quran memorization", kind: "measurable", unit: "verses", target_value: 3, frequency: "daily", category: "Memorization" },
        { name: "Morning adhkar", kind: "binary", target_value: 1, frequency: "daily", category: "Adhkar" },
        { name: "Evening adhkar", kind: "binary", target_value: 1, frequency: "daily", category: "Adhkar" },
      ]} />
  );
}
