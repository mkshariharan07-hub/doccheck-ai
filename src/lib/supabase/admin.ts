import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const STORAGE_BUCKETS = ["documents", "reports"] as const;

let cached: SupabaseClient | null | undefined;

export function getAdmin(): SupabaseClient | null {
  if (cached === undefined) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    cached =
      url && serviceRoleKey
        ? createClient(url, serviceRoleKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          })
        : null;
  }
  return cached;
}

export function requireAdmin(): SupabaseClient {
  const client = getAdmin();
  if (!client) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return client;
}

export async function ensureStorageBuckets(client: SupabaseClient): Promise<void> {
  const { data: buckets } = await client.storage.listBuckets();
  const existing = new Set((buckets ?? []).map((bucket) => bucket.id));

  for (const id of STORAGE_BUCKETS) {
    if (!existing.has(id)) {
      await client.storage.createBucket(id, { public: false });
    }
  }
}

export function safeSegment(name: string): string {
  return name.replace(/[\\/]/g, "_").replace(/[\u0000-\u001f]/g, "").trim() || "file";
}

export async function uploadToBucket(
  client: SupabaseClient,
  bucket: string,
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  const { error } = await client.storage
    .from(bucket)
    .upload(path, buffer, { contentType, upsert: true });
  if (error) throw error;
}

export async function downloadFromBucket(
  client: SupabaseClient,
  bucket: string,
  path: string
): Promise<Blob> {
  const { data, error } = await client.storage.from(bucket).download(path);
  if (error) throw error;
  return data;
}