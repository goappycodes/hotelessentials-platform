import "server-only"

import { ITEM_IMAGES_BUCKET } from "@/constants/items"
import { createRequestClient } from "@/lib/supabase/server"

type Client = Awaited<ReturnType<typeof createRequestClient>>

const SIGNED_URL_SECONDS = 60 * 60

export async function getHsnCodes(supabase: Client) {
  const { data, error } = await supabase
    .from("hsn_codes")
    .select("id, code, description")
    .order("code")
  if (error) throw new Error("Failed to load HSN codes")
  return data
}

// Short-lived URLs for files in the private item images bucket, keyed by path.
export async function getSignedImageUrls(supabase: Client, paths: string[]) {
  if (paths.length === 0) return new Map<string, string>()
  const { data } = await supabase.storage
    .from(ITEM_IMAGES_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_SECONDS)
  return new Map(
    (data ?? []).flatMap((entry) =>
      entry.path && entry.signedUrl ? [[entry.path, entry.signedUrl] as const] : []
    )
  )
}

export type ItemImageView = { id: string; url: string; fileName: string }

export async function getItemImages(supabase: Client, itemId: string): Promise<ItemImageView[]> {
  const { data, error } = await supabase
    .from("item_images")
    .select("id, storage_path, file_name")
    .eq("item_id", itemId)
    .order("sort_order")
  if (error) throw new Error("Failed to load item images")

  const urls = await getSignedImageUrls(supabase, data.map((image) => image.storage_path))
  return data.flatMap((image) => {
    const url = urls.get(image.storage_path)
    return url ? [{ id: image.id, url, fileName: image.file_name }] : []
  })
}
