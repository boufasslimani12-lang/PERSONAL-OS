import {
  LayoutDashboard, Target, ListChecks, Repeat, CalendarDays, Dumbbell, GraduationCap, Languages, Code2, Users,
  Briefcase, Moon, Wallet, Sprout, NotebookPen, BarChart3, Settings, type LucideIcon,
} from "lucide-react";

export interface NavItem { href: string; label: string; icon: LucideIcon; group: "core" | "life" | "system" }

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "core" },
  { href: "/goals", label: "My Goals", icon: Target, group: "core" },
  { href: "/tasks", label: "Tasks & Projects", icon: ListChecks, group: "core" },
  { href: "/habits", label: "Habits", icon: Repeat, group: "core" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, group: "core" },
  { href: "/fitness", label: "Fitness & Health", icon: Dumbbell, group: "life" },
  { href: "/education", label: "Education", icon: GraduationCap, group: "life" },
  { href: "/languages", label: "Languages", icon: Languages, group: "life" },
  { href: "/skills/hard", label: "Hard Skills", icon: Code2, group: "life" },
  { href: "/skills/soft", label: "Soft Skills", icon: Users, group: "life" },
  { href: "/career", label: "Career & Business", icon: Briefcase, group: "life" },
  { href: "/religion", label: "Religion", icon: Moon, group: "life" },
  { href: "/finance", label: "Finance", icon: Wallet, group: "life" },
  { href: "/growth", label: "Personal Growth", icon: Sprout, group: "life" },
  { href: "/journal", label: "Journal & Notes", icon: NotebookPen, group: "life" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, group: "system" },
  { href: "/settings", label: "Settings", icon: Settings, group: "system" },
];

export const MOBILE_PRIMARY = ["/dashboard", "/tasks", "/habits", "/calendar"];

/** Maps a life-area key to its module page. */
export const AREA_HREF: Record<string, string> = {
  health: "/fitness", education: "/education", languages: "/languages", hard_skills: "/skills/hard",
  soft_skills: "/skills/soft", career: "/career", religion: "/religion", finance: "/finance", growth: "/growth", mind: "/journal",
};
