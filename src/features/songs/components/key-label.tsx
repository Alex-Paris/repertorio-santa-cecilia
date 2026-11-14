export function KeyLabel({ musicalKey }: { musicalKey: string }) {
  return (
    <span className="font-mono text-sm font-semibold text-chord">
      <span className="sr-only">Tom </span>
      {musicalKey}
    </span>
  );
}
