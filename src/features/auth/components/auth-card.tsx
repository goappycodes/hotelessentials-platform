import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type AuthCardProps = {
  title: string
  description: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer && (
        <CardFooter className="justify-center text-sm text-muted-foreground">
          {footer}
        </CardFooter>
      )}
    </Card>
  )
}

export function AuthCardSkeleton() {
  return (
    <Card className="w-full max-w-md" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <CardHeader className="gap-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-full" />
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
        <Skeleton className="h-9 w-full" />
      </CardContent>
    </Card>
  )
}
