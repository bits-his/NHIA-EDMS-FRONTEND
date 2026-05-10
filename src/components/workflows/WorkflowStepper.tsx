/**
 * Compact visual summary of step count for workflow template cards.
 */
export function WorkflowStepper({ steps }: { steps: unknown[] }) {
  const n = Array.isArray(steps) ? steps.length : 0;
  if (n === 0) return null;
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {Array.from({ length: Math.min(n, 8) }, (_, i) => (
        <span
          key={i}
          className="h-1.5 flex-1 min-w-[12px] max-w-[40px] rounded-full bg-primary/25 first:bg-primary/50"
        />
      ))}
      {n > 8 ? <span className="text-[10px] text-muted-foreground ml-0.5">+{n - 8}</span> : null}
    </div>
  );
}
