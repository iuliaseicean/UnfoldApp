import api from "@/lib/api";
import { Capsule } from "@/types/capsule";

export type CapsuleDetailsResponse = {
  capsule: Capsule;
  contributions: any[];
  uniqueContributors: number | null;
};

export async function getCapsules(): Promise<Capsule[]> {
  const res = await api.get("/capsules/my");
  return res.data;
}

export async function getCapsuleById(id: number): Promise<CapsuleDetailsResponse> {
  const res = await api.get<CapsuleDetailsResponse>(`/capsules/${id}`);
  return res.data;
}

export async function createCapsule(payload: {
  title: string;
  description?: string | null;
  capsule_type: "time" | "co" | "key";
  open_at?: string;
  required_contributors?: number;
  visibility_duration?: number;
}): Promise<Capsule> {
  const res = await api.post("/capsules", payload);
  return res.data;
}
