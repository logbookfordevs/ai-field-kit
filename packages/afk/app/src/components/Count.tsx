/** A count shown after a heading; screen readers hear "Try later, 4" rather than "Try later4". */
export function Count({ n, className = "count" }: { n: number; className?: string }) {
  return <span className={`${className} num`}><span className="vh">, </span>{n}</span>;
}
