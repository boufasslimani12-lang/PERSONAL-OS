import { loadSkills } from "@/lib/server/skills";
import { SkillsView } from "../skills-view";

export const metadata = { title: "Hard Skills" };

export default async function HardSkillsPage() {
  return <SkillsView kind="hard" {...await loadSkills("hard")} />;
}
