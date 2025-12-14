import api from "@/lib/api";

export async function uploadImageAsync(uri: string) {
  const filename = uri.split("/").pop() || `photo-${Date.now()}.jpg`;
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : "image/jpeg";

  const form = new FormData();
  form.append("file", {
    uri,
    name: filename,
    type,
  } as any);

  const res = await api.post("/upload/image", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data.url as string;
}