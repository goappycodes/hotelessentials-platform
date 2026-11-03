import { cn } from "@/lib/utils"

export function PageContainer({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8", className)}
      {...props}
    />
  )
}
