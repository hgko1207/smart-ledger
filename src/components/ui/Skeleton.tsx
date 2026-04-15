interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-800 rounded-2xl ${className}`}
      aria-hidden="true"
    />
  );
}

export function PageSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8" role="status" aria-live="polite" aria-label="로딩 중">
      <Skeleton className="h-8 w-48 mb-8 !rounded-lg" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-80 mb-6" />
      <Skeleton className="h-64" />
      <span className="sr-only">로딩 중입니다</span>
    </div>
  );
}
