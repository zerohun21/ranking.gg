import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-28 w-full rounded-lg" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="ml-auto h-8 w-32" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <Skeleton className="hidden h-96 lg:block" />
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
