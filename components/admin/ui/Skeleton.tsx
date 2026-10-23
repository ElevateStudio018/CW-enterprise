/** A pulsing placeholder shape while something loads. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-lg bg-stone-200/80 ${className}`} />;
}

export function SkeletonLines({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2.5" role="status" aria-label="Laddar">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={`h-4 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}
