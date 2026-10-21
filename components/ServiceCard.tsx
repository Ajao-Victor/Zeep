import Link from "next/link";

export function ServiceCard({
  name,
  summary,
  cost,
  href,
}: {
  name: string;
  summary: string;
  cost: string;
  href?: string;
}) {
  const body = (
    <>
      <b className="text-[15px] font-medium">{name}</b>
      <p className="mt-1.5 text-[13px] leading-normal text-muted">{summary}</p>
      <span className="mt-auto block pt-3 font-mono text-[12px] text-gold">{cost}</span>
    </>
  );
  if (!href) return <div className="flex h-full flex-col bg-bg p-5">{body}</div>;
  return (
    <Link href={href} className="flex h-full flex-col bg-surface p-5 transition-colors duration-150 hover:bg-raised">
      {body}
    </Link>
  );
}
