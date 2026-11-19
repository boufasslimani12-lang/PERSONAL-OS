import { loadSkills } from "@/lib/server/skills";
import { SkillsView } from "../skills-view";

export const metadata = { title: "Soft Skills" };

export default async function SoftSkillsPage() {
  return <SkillsView kind="soft" {...await loadSkills("soft")} />;
}
