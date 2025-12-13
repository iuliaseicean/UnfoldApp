export type CapsuleType = "time" | "contributors" | "key";
export type CapsuleStatus = "locked" | "open" | "archived";

export type Capsule = {
  capsule_id: number;
  creator_id: number;
  title?: string | null;
  description?: string | null;

  capsule_type: CapsuleType;
  status: CapsuleStatus;

  open_at?: string | null;
  visibility_duration?: number | null;
  required_contributors?: number | null;

  opened_at?: string | null;
  archived_at?: string | null;
  created_at?: string | null;
};
