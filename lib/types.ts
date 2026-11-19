import type { Database } from "./supabase/database.types";

export type TableName = keyof Database["public"]["Tables"];
export type Row<T extends TableName> = Database["public"]["Tables"][T]["Row"];
export type Insert<T extends TableName> = Database["public"]["Tables"][T]["Insert"];
export type Update<T extends TableName> = Database["public"]["Tables"][T]["Update"];

export type LifeArea = Row<"life_areas">;
export type Goal = Row<"goals">;
export type Task = Row<"tasks">;
export type Project = Row<"projects">;
export type Habit = Row<"habits">;
export type HabitLog = Row<"habit_logs">;
export type Profile = Row<"profiles">;
