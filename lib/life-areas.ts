// Single source of truth for how a life area's active/inactive state affects the UI.
//  * Active areas appear in navigation and selectors and are scored.
//  * Inactive areas are hidden from navigation and new-item selectors and excluded from scoring,
//    but nothing is deleted: their records stay linked and the module page stays reachable.
// Pure module (no imports) so it can be unit-tested with node --test.

export interface AreaLike { id: string; key: string; name: string; is_active: boolean }

/** Maps a life-area key to its module page. */
export const AREA_HREF: Record<string, string> = {
  health: "/fitness", education: "/education", languages: "/languages", hard_skills: "/skills/hard",
  soft_skills: "/skills/soft", career: "/career", religion: "/religion", finance: "/finance", growth: "/growth", mind: "/journal",
};

export function activeAreas<T extends AreaLike>(areas: T[]): T[] {
  return areas.filter((a) => a.is_active);
}

/** Module pages to hide from navigation because their life area is inactive. */
export function inactiveAreaPages(areas: AreaLike[]): { href: string; name: string }[] {
  return areas.filter((a) => !a.is_active && AREA_HREF[a.key]).map((a) => ({ href: AREA_HREF[a.key], name: a.name }));
}

/**
 * Options for a "Life area" selector: active areas only, plus the record's current area when it is
 * inactive (labelled), so editing an existing record never silently drops its area.
 */
export function areaOptions(areas: AreaLike[], currentId?: string | null): { value: string; label: string }[] {
  return areas
    .filter((a) => a.is_active || a.id === currentId)
    .map((a) => ({ value: a.id, label: a.is_active ? a.name : `${a.name} (inactive)` }));
}

/** Options for filtering existing data: every area, inactive ones labelled, so old records stay findable. */
export function areaFilterOptions(areas: AreaLike[]): { value: string; label: string }[] {
  return areas.map((a) => ({ value: a.id, label: a.is_active ? a.name : `${a.name} (inactive)` }));
}
