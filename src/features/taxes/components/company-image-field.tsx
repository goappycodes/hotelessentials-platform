"use client"

import { ImageIcon, Trash2, Upload } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useRef, useTransition } from "react"
import { toast } from "sonner"

import { setCompanyImage } from "@/actions/organization"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  COMPANY_ASSETS_BUCKET,
  COMPANY_IMAGE_TYPES,
  MAX_COMPANY_IMAGE_BYTES,
} from "@/constants/quotations"
import { createClient } from "@/lib/supabase/client"

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
}

// The logo or the signature stamp printed on quotations. Uploads straight away; the
// previous image is replaced.
export function CompanyImageField({
  kind,
  label,
  hint,
  url,
  canEdit,
}: {
  kind: "logo" | "signature"
  label: string
  hint: string
  url: string | null
  canEdit: boolean
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()

  function upload(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = ""
    if (!file) return
    if (!COMPANY_IMAGE_TYPES.includes(file.type)) {
      toast.error(`${file.name} isn't a PNG, JPG or WebP image.`)
      return
    }
    if (file.size > MAX_COMPANY_IMAGE_BYTES) {
      toast.error(`${file.name} is larger than 2 MB.`)
      return
    }
    startTransition(async () => {
      const supabase = createClient()
      const path = `${kind}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`
      const { error } = await supabase.storage
        .from(COMPANY_ASSETS_BUCKET)
        .upload(path, file, { contentType: file.type })
      if (error) {
        toast.error("The image couldn't be uploaded.")
        return
      }
      const result = await setCompanyImage(kind, path)
      if (!result.success) {
        await supabase.storage.from(COMPANY_ASSETS_BUCKET).remove([path])
        toast.error(result.error)
        return
      }
      toast.success(`${label} saved.`)
      router.refresh()
    })
  }

  function remove() {
    startTransition(async () => {
      const result = await setCompanyImage(kind, null)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(`${label} removed.`)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
        {url ? (
          <Image src={url} alt={label} fill unoptimized sizes="96px" className="object-contain p-1" />
        ) : (
          <ImageIcon className="size-7 text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
        {canEdit && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => inputRef.current?.click()}
            >
              {isPending ? <Spinner /> : <Upload />}
              {url ? "Replace" : "Upload"}
            </Button>
            {url && (
              <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={remove}>
                <Trash2 />
                Remove
              </Button>
            )}
            <input
              ref={inputRef}
              type="file"
              accept={COMPANY_IMAGE_TYPES.join(",")}
              hidden
              onChange={(event) => upload(event.target.files?.[0])}
            />
          </div>
        )}
      </div>
    </div>
  )
}
