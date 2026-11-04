"use client"

import { ImageIcon } from "lucide-react"
import Image from "next/image"
import { useState } from "react"

import type { ItemImageView } from "@/features/items/queries"
import { cn } from "@/lib/utils"

// Read-only images on an opened item: the selected image large, others as thumbnails.
// Images are added or removed on the item's edit page.
export function ItemImagesGallery({ images }: { images: ItemImageView[] }) {
  const [selectedId, setSelectedId] = useState(images[0]?.id)
  const selected = images.find((image) => image.id === selectedId) ?? images[0]

  if (!selected) {
    return (
      <div className="flex aspect-[7/6] flex-col items-center justify-center gap-2 rounded-xl border bg-muted/40 text-sm text-muted-foreground">
        <ImageIcon className="size-9 stroke-[1.5]" />
        No image
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-[7/6] overflow-hidden rounded-xl border bg-card">
        <Image
          src={selected.url}
          alt={selected.fileName}
          fill
          unoptimized
          sizes="256px"
          // The biggest thing in the opened item (its Largest Contentful Paint), so it
          // loads straight away instead of lazily.
          loading="eager"
          className="object-contain"
        />
      </div>
      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-1.5">
          {images.map((image) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setSelectedId(image.id)}
              aria-label={`Show ${image.fileName}`}
              aria-pressed={image.id === selected.id}
              className={cn(
                "relative aspect-square overflow-hidden rounded-md border bg-muted",
                image.id === selected.id && "ring-2 ring-primary"
              )}
            >
              <Image
                src={image.url}
                alt=""
                fill
                unoptimized
                sizes="48px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
