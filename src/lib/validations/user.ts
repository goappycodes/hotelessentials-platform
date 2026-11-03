import { z } from "zod"

import { APP_MODULES, USER_ROLES } from "@/constants/permissions"
import { email, password } from "@/lib/validations/auth"

const permissionSet = z.object({
  view: z.boolean(),
  create: z.boolean(),
  edit: z.boolean(),
  delete: z.boolean(),
})

const userDetails = {
  firstName: z
    .string()
    .trim()
    .min(1, "Enter a first name")
    .max(50, "First name must be at most 50 characters"),
  lastName: z.string().trim().max(50, "Last name must be at most 50 characters"),
  phone: z
    .string()
    .trim()
    .max(30, "Phone number must be at most 30 characters")
    .regex(/^[0-9+()\-\s]*$/, "Use digits, spaces and + ( ) - only"),
  role: z.enum(USER_ROLES),
  permissions: z.record(z.enum(APP_MODULES), permissionSet),
}

export const createUserSchema = z.object({ ...userDetails, email, password })

export const updateUserSchema = z.object({ ...userDetails, isActive: z.boolean() })

export const userIdSchema = z.uuid()

// One form serves both pages: email and password are only editable when creating,
// and the active switch only when editing.
export const userFormSchemas = {
  create: createUserSchema.extend({ isActive: z.boolean() }),
  edit: updateUserSchema.extend({ email: z.string(), password: z.string() }),
}

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type UserFormValues = z.infer<typeof userFormSchemas.create>
