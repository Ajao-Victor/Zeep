import type { ComponentProps } from "react";
import { Button } from "@/components/Button";
import { Forge, ForgeGlyph } from "@/components/fx/Forge";
import type { ForgePhase } from "@/lib/fx/forge";
import { cx } from "@/lib/cx";

const PHASE_LABEL: Record<Exclude<ForgePhase, "idle" | "failed" | "settled">, string> = {
  preparing: "Preparing…",
  proving: "Proving…",
  sending: "Sending…",
};

// What a screen reader hears; the in-between phases are too quick to be worth announcing.
const ANNOUNCE: Partial<Record<ForgePhase, string>> = { proving: "Proving" };

type Props = Omit<ComponentProps<typeof Button>, "children" | "busy" | "href" | "variant"> & {
  /** From useForge(). */
  phase: ForgePhase;
  /** The idle label, e.g. "Search". */
  label: string;
  /** Shown once the paid request succeeded. */
  settledLabel?: string;
};

/**
 * A primary button that plays the Forge while its paid request runs (spec section 6). All the
 * labels share one grid cell, so the width never changes between phases.
 */
export function ProofButton({ phase, label, settledLabel = "Sent", className, ...props }: Props) {
  const busy = phase === "preparing" || phase === "proving" || phase === "sending";
  const working = phase !== "idle" && phase !== "failed";
  const labels = [...Object.entries(PHASE_LABEL), ["settled", settledLabel]] as [ForgePhase, string][];
  return (
    <>
      <Button {...props} busy={busy} className={cx("overflow-hidden", className)}>
        <Forge phase={phase}>
          <span className="grid">
            <span className={cx("col-start-1 row-start-1 justify-self-center", working && "invisible")}>{label}</span>
            <span className={cx("col-start-1 row-start-1 inline-flex items-center justify-center gap-2", !working && "invisible")}>
              <ForgeGlyph />
              <span className="grid">
                {labels.map(([key, text]) => (
                  <span key={key} className={cx("col-start-1 row-start-1", key !== phase && "invisible")}>
                    {text}
                  </span>
                ))}
              </span>
            </span>
          </span>
        </Forge>
      </Button>
      <span role="status" className="sr-only">
        {phase === "settled" ? settledLabel : (ANNOUNCE[phase] ?? "")}
      </span>
    </>
  );
}
