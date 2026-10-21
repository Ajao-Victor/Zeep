import { shortTag } from "@/lib/format";

export function ProofTag({ tag, local = false }: { tag: string; local?: boolean }) {
  return (
    <p className="font-mono text-[12px] text-ok">
      {local ? "local tag" : "proof"} {shortTag(tag)}
    </p>
  );
}
