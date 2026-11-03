"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { MailCheck } from "lucide-react"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"

import { requestPasswordReset } from "@/actions/auth"
import { FormError } from "@/components/shared/form-error"
import { FormInputField } from "@/components/shared/form-input-field"
import { SubmitButton } from "@/components/shared/submit-button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { FieldGroup } from "@/components/ui/field"
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validations/auth"

export function ForgotPasswordForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const [isSent, setIsSent] = useState(false)

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  })

  function onSubmit(values: ForgotPasswordInput) {
    setError(undefined)
    startTransition(async () => {
      const result = await requestPasswordReset(values)
      if (result.success) setIsSent(true)
      else setError(result.error)
    })
  }

  if (isSent) {
    return (
      <Alert>
        <MailCheck />
        <AlertTitle>Check your inbox</AlertTitle>
        <AlertDescription>
          If an account exists for that email, you will receive a link to reset
          your password shortly.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <FormError message={error} />
        <FormInputField
          control={form.control}
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
        />
        <SubmitButton pending={isPending} className="w-full">
          Send reset link
        </SubmitButton>
      </FieldGroup>
    </form>
  )
}
