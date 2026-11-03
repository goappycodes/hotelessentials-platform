import { z } from "zod"

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Email address is too long")
  .pipe(z.email("Enter a valid email address"))

export const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number")

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
})

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
