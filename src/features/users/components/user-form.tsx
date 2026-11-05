"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Info } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form"
import { toast } from "sonner"

import { createUser, updateUser } from "@/actions/users"
import { FormError } from "@/components/shared/form-error"
import { FormFieldLabel } from "@/components/shared/form-field-label"
import { FormInputField } from "@/components/shared/form-input-field"
import { SubmitButton } from "@/components/shared/submit-button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  USER_ROLES,
  type UserRole,
} from "@/constants/permissions"
import { ROUTES } from "@/constants/routes"
import { PermissionsMatrix } from "@/features/users/components/permissions-matrix"
import { getRoleDefaultPermissions, isAdminRole } from "@/lib/permissions"
import { scrollToFirstInvalid } from "@/lib/scroll-to-invalid"
import { userFormSchemas, type UserFormValues } from "@/lib/validations/user"

type UserFormProps = {
  // Only owners may give someone the owner role.
  canAssignOwner: boolean
} & (
  | { mode: "create" }
  | {
      mode: "edit"
      userId: string
      defaultValues: UserFormValues
      // Editing your own account: role and status are locked.
      isSelf: boolean
      // An admin viewing an owner: nothing can be changed.
      readOnly: boolean
    }
)

const NEW_USER: UserFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  role: "staff",
  isActive: true,
  permissions: getRoleDefaultPermissions("staff"),
}

export function UserForm(props: UserFormProps) {
  const { mode, canAssignOwner } = props
  const isSelf = mode === "edit" && props.isSelf
  const readOnly = mode === "edit" && props.readOnly

  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string>()

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchemas[mode]) as Resolver<UserFormValues>,
    // scrollToFirstInvalid does this, dropdowns included.
    shouldFocusError: false,
    defaultValues: mode === "edit" ? props.defaultValues : NEW_USER,
  })
  const role = useWatch({ control: form.control, name: "role" })
  const roles = USER_ROLES.filter(
    (option) => option !== "owner" || canAssignOwner || option === role
  )

  function onSubmit(values: UserFormValues) {
    setError(undefined)
    startTransition(async () => {
      const { email, password, isActive, ...details } = values
      const result =
        mode === "create"
          ? await createUser({ ...details, email, password })
          : await updateUser(props.userId, { ...details, isActive })

      if (!result.success) {
        setError(result.error)
        return
      }

      toast.success(mode === "create" ? "User created." : "User updated.")
      router.push(ROUTES.users)
    })
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit, scrollToFirstInvalid)}
      noValidate
      className="flex flex-col gap-6"
    >
      <FormError message={error} />
      {readOnly && (
        <Alert>
          <Info />
          <AlertDescription>
            Only an owner can change an owner&apos;s account.
          </AlertDescription>
        </Alert>
      )}
      <fieldset disabled={readOnly || isPending} className="contents">
        <Card>
          <CardHeader>
            <CardTitle>User details</CardTitle>
            <CardDescription>
              {mode === "create"
                ? "They sign in with this email and password."
                : "Name and contact details shown across the app."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-5 sm:grid-cols-2">
              <FormInputField
                control={form.control}
                name="firstName"
                required
                label="First name"
                autoComplete="off"
              />
              <FormInputField
                control={form.control}
                name="lastName"
                label="Last name"
                autoComplete="off"
              />
              <FormInputField
                control={form.control}
                name="email"
                required={mode === "create"}
                label="Email"
                type="email"
                autoComplete="off"
                placeholder="name@company.com"
                disabled={mode === "edit"}
                description={mode === "edit" ? "Email can't be changed." : undefined}
              />
              <FormInputField
                control={form.control}
                name="phone"
                label="Phone"
                type="tel"
                autoComplete="off"
              />
              {mode === "create" && (
                <FormInputField
                  control={form.control}
                  name="password"
                  required
                  label="Password"
                  type="password"
                  autoComplete="new-password"
                  description="At least 8 characters with upper and lowercase letters and a number. Share it with the user securely."
                />
              )}
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Role and access</CardTitle>
            <CardDescription>
              Picking a role fills in its usual permissions. You can adjust them below.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <FieldGroup className="grid gap-5 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <Field>
                    <FormFieldLabel htmlFor="role" label="Role" required />
                    <Select
                      value={field.value}
                      disabled={isSelf || readOnly || isPending}
                      onValueChange={(value: UserRole) => {
                        field.onChange(value)
                        form.setValue("permissions", getRoleDefaultPermissions(value))
                      }}
                    >
                      <SelectTrigger id="role" className="w-full">
                        {/* Explicit label so the server render isn't blank. */}
                        <SelectValue>{ROLE_LABELS[field.value]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((option) => (
                          <SelectItem key={option} value={option}>
                            {ROLE_LABELS[option]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      {isSelf
                        ? "You can't change your own role."
                        : ROLE_DESCRIPTIONS[field.value]}
                    </FieldDescription>
                  </Field>
                )}
              />
              {mode === "edit" && (
                <Controller
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <Field orientation="horizontal" className="self-start sm:pt-6">
                      <Switch
                        id="isActive"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isSelf || readOnly || isPending}
                      />
                      <FieldContent>
                        <FieldLabel htmlFor="isActive">Active</FieldLabel>
                        <FieldDescription>
                          {isSelf
                            ? "You can't deactivate your own account."
                            : field.value
                              ? "Can sign in and use the app."
                              : "Can't sign in. Their records are kept."}
                        </FieldDescription>
                      </FieldContent>
                    </Field>
                  )}
                />
              )}
            </FieldGroup>

            {isAdminRole(role) ? (
              <p className="rounded-lg border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                {ROLE_LABELS[role]}s have full access to every module and can manage
                users.
              </p>
            ) : (
              <Controller
                control={form.control}
                name="permissions"
                render={({ field }) => (
                  <PermissionsMatrix value={field.value} onChange={field.onChange} />
                )}
              />
            )}
          </CardContent>
        </Card>
      </fieldset>

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline">
          <Link href={ROUTES.users}>{readOnly ? "Back" : "Cancel"}</Link>
        </Button>
        {!readOnly && (
          <SubmitButton pending={isPending}>
            {mode === "create" ? "Create user" : "Update"}
          </SubmitButton>
        )}
      </div>
    </form>
  )
}

export function UserFormSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading…</span>
      {[4, 2].map((fields, card) => (
        <Card key={card}>
          <CardHeader className="gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            {Array.from({ length: fields }, (_, index) => (
              <div key={index} className="flex flex-col gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
