import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export function SubmitButton({
  pending,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "type"> & { pending: boolean }) {
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...props}>
      {pending && <Spinner />}
      {children}
    </Button>
  )
}
