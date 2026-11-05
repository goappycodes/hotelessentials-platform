"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { signIn } from "@/actions/auth";
import { FormError } from "@/components/shared/form-error";
import { FormInputField } from "@/components/shared/form-input-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { FieldGroup } from "@/components/ui/field";
import { ROUTES } from "@/constants/routes";
import { scrollToFirstInvalid } from "@/lib/scroll-to-invalid";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { EyeClosed } from "lucide-react";

export function LoginForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [isPasswordView, setIsPasswordView] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    // scrollToFirstInvalid does this, dropdowns included.
    shouldFocusError: false,
    defaultValues: { email: "", password: "" },
  });

  function onSubmit(values: LoginInput) {
    setError(undefined);
    startTransition(async () => {
      const result = await signIn(values);
      if (!result.success) setError(result.error);
    });
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit, scrollToFirstInvalid)}
      noValidate
    >
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
        <FormInputField
          control={form.control}
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          showPasswordToggle
          labelAction={
            <Link
              href={ROUTES.forgotPassword}
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          }
        />
        <SubmitButton pending={isPending} className="w-full">
          Sign in
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}
