"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { updatePassword } from "@/actions/auth"
import { FormError } from "@/components/shared/form-error"
import { FormInputField } from "@/components/shared/form-input-field"
import { SubmitButton } from "@/components/shared/submit-button"
import { FieldGroup } from "@/components/ui/field"
import { ROUTES } from "@/constants/routes"
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validations/auth"

export function ResetPasswordForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string>()

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  })

  function onSubmit(values: ResetPasswordInput) {
    setError(undefined)
    startTransition(async () => {
      const result = await updatePassword(values)
      if (!result.success) {
        setError(result.error)
        return
      }
      toast.success("Your password has been updated.")
      router.replace(ROUTES.dashboard)
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <FormError message={error} />
        <FormInputField
          control={form.control}
          name="password"
          label="New password"
          type="password"
          autoComplete="new-password"
          description="At least 8 characters with uppercase, lowercase and a number."
        />
        <FormInputField
          control={form.control}
          name="confirmPassword"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
        />
        <SubmitButton pending={isPending} className="w-full">
          Update password
        </SubmitButton>
      </FieldGroup>
    </form>
  )
}
