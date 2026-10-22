import { Card, Surface } from "@/components/ui/Surface";
import { cx } from "@/lib/cx";

export function ServiceCard({
  name,
  summary,
  cost,
  href,
  className,
}: {
  name: string;
  summary: string;
  cost: string;
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      <b className="text-[15px] font-medium">{name}</b>
      <p className="mt-1.5 text-[13px] leading-normal text-muted">{summary}</p>
      <span className="mt-auto block pt-3 font-mono text-[12px] text-gold">{cost}</span>
    </>
  );
  if (!href) {
    return (
      <Surface as="article" padding="card" className={cx("flex flex-col", className)}>
        {body}
      </Surface>
    );
  }
  return (
    <Card href={href} className={className}>
      {body}
    </Card>
  );
}
