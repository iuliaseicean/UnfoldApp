import api from "@/lib/api";
import { Capsule } from "@/types/capsule";

export async function getCapsules(): Promise<Capsule[]> {
  const res = await api.get("/capsules");
  return res.data;
}

export async function getCapsuleById(id: number): Promise<Capsule> {
  const res = await api.get(`/capsules/${id}`);
  return res.data;
}

export async function createCapsule(payload: {
  title: string;
  description?: string | null;
  capsule_type: "time" | "contributors" | "key";
  open_at?: string;
  required_contributors?: number;
  visibility_duration?: number;
}): Promise<Capsule> {
  const res = await api.post("/capsules", payload);
  return res.data;
}
