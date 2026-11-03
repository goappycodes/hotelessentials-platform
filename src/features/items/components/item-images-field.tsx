"use client"

import { ImageIcon, ImagePlus, X } from "lucide-react"
import Image from "next/image"
import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { addItemImages, removeItemImage } from "@/actions/items"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  ITEM_IMAGE_TYPES,
  ITEM_IMAGES_BUCKET,
  MAX_ITEM_IMAGE_BYTES,
  MAX_ITEM_IMAGES,
} from "@/constants/items"
import type { ItemImageView } from "@/features/items/queries"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

export type PendingImage = { id: string; file: File; previewUrl: string }

type ItemImagesFieldProps = {
  existing: ItemImageView[]
  onExistingChange: (images: ItemImageView[]) => void
  pending: PendingImage[]
  onPendingChange: (images: PendingImage[]) => void
  disabled?: boolean
}

// New images are kept in the browser until the item is saved (see uploadItemImages);
// removing a saved image deletes it straight away.
export function ItemImagesField({
  existing,
  onExistingChange,
  pending,
  onPendingChange,
  disabled,
}: ItemImagesFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const previewUrls = useRef(new Set<string>())
  const [isRemoving, startRemoving] = useTransition()
  const [isDragging, setIsDragging] = useState(false)
  const remaining = MAX_ITEM_IMAGES - existing.length - pending.length

  useEffect(() => {
    const urls = previewUrls.current
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  function handleFiles(files: FileList | null) {
    if (!files) return
    const accepted: PendingImage[] = []
    for (const file of Array.from(files)) {
      if (!ITEM_IMAGE_TYPES.includes(file.type)) {
        toast.error(`${file.name} isn't a JPG, PNG, WebP or GIF image.`)
      } else if (file.size > MAX_ITEM_IMAGE_BYTES) {
        toast.error(`${file.name} is larger than 5 MB.`)
      } else if (accepted.length >= remaining) {
        toast.error(`An item can have at most ${MAX_ITEM_IMAGES} images.`)
        break
      } else {
        const previewUrl = URL.createObjectURL(file)
        previewUrls.current.add(previewUrl)
        accepted.push({ id: crypto.randomUUID(), file, previewUrl })
      }
    }
    if (accepted.length) onPendingChange([...pending, ...accepted])
    if (inputRef.current) inputRef.current.value = ""
  }

  function removePending(image: PendingImage) {
    URL.revokeObjectURL(image.previewUrl)
    previewUrls.current.delete(image.previewUrl)
    onPendingChange(pending.filter((entry) => entry.id !== image.id))
  }

  function removeExisting(image: ItemImageView) {
    startRemoving(async () => {
      const result = await removeItemImage(image.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      onExistingChange(existing.filter((entry) => entry.id !== image.id))
    })
  }

  const tiles = [
    ...existing.map((image) => ({
      key: image.id,
      url: image.url,
      name: image.fileName,
      onRemove: () => removeExisting(image),
    })),
    ...pending.map((image) => ({
      key: image.id,
      url: image.previewUrl,
      name: image.file.name,
      onRemove: () => removePending(image),
    })),
  ]

  const canAdd = !disabled && remaining > 0

  const dropHandlers = canAdd
    ? {
        onDragOver: (event: React.DragEvent) => {
          event.preventDefault()
          setIsDragging(true)
        },
        onDragLeave: () => setIsDragging(false),
        onDrop: (event: React.DragEvent) => {
          event.preventDefault()
          setIsDragging(false)
          handleFiles(event.dataTransfer.files)
        },
      }
    : {}

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept={ITEM_IMAGE_TYPES.join(",")}
      multiple
      hidden
      onChange={(event) => handleFiles(event.target.files)}
    />
  )

  if (tiles.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <div
          {...dropHandlers}
          className={cn(
            "flex aspect-[7/6] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-card p-4 text-center text-sm text-muted-foreground transition-colors",
            isDragging && "border-primary bg-primary/5"
          )}
        >
          <ImageIcon className="size-9 stroke-[1.5]" />
          <p>
            {disabled ? "No images" : "Drag image(s) here or"}
            {canAdd && (
              <>
                <br />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="font-medium text-primary hover:underline"
                >
                  Browse images
                </button>
              </>
            )}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Up to {MAX_ITEM_IMAGES} images, 5 MB each (JPG, PNG, WebP or GIF).
        </p>
        {fileInput}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        {...dropHandlers}
        className={cn(
          "grid grid-cols-3 gap-2 rounded-xl border-2 border-dashed border-transparent p-1 transition-colors",
          isDragging && "border-primary bg-primary/5"
        )}
      >
        {tiles.map((tile) => (
          <div
            key={tile.key}
            className="group/image relative aspect-square overflow-hidden rounded-lg border bg-muted"
          >
            <Image
              src={tile.url}
              alt={tile.name}
              fill
              unoptimized
              sizes="96px"
              className="object-cover"
            />
            {!disabled && (
              <Button
                type="button"
                variant="secondary"
                size="icon-xs"
                aria-label={`Remove ${tile.name}`}
                disabled={isRemoving}
                onClick={tile.onRemove}
                className="absolute top-1 right-1 opacity-90 shadow-sm"
              >
                <X />
              </Button>
            )}
          </div>
        ))}
        {canAdd && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            {isRemoving ? <Spinner /> : <ImagePlus className="size-5" />}
            Add image
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {canAdd ? "Drag more images here. " : ""}Up to {MAX_ITEM_IMAGES} images, 5 MB each.
      </p>
      {fileInput}
    </div>
  )
}

// Uploads images to storage under `<itemId>/` and records them. Uploaded files are
// removed again if they cannot be recorded.
export async function uploadItemImages(itemId: string, images: PendingImage[]) {
  const supabase = createClient()
  const uploaded: Parameters<typeof addItemImages>[1] = []

  try {
    for (const { file } of images) {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
      const storagePath = `${itemId}/${crypto.randomUUID()}.${extension}`
      const { error } = await supabase.storage
        .from(ITEM_IMAGES_BUCKET)
        .upload(storagePath, file, { contentType: file.type })
      if (error) throw error
      uploaded.push({
        storagePath,
        fileName: file.name.slice(0, 200),
        contentType: file.type,
        fileSize: file.size,
      })
    }

    const result = await addItemImages(itemId, uploaded)
    if (!result.success) throw new Error(result.error)
  } catch (error) {
    if (uploaded.length) {
      await supabase.storage
        .from(ITEM_IMAGES_BUCKET)
        .remove(uploaded.map((image) => image.storagePath))
    }
    throw error
  }
}
