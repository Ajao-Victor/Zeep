"use client";

import { useEffect, useState } from "react";
import { ACTIVITY_PREVIEW, readActivity, subscribeActivity, type Activity } from "@/lib/account/activity";
import { Panel } from "@/components/Panel";
import { useVault } from "@/components/Providers";

function when(at: number): string {
  const date = new Date(at);
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (date.toDateString() === new Date().toDateString()) return time;
  return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${time}`;
}

export function RecentActivity() {
  const { view } = useVault();
  const [items, setItems] = useState<Activity[]>([]);
  const [all, setAll] = useState(false);

  useEffect(() => {
    let stop = false;
    const load = () => {
      void readActivity(view.network).then((next) => {
        if (!stop) setItems(next);
      });
    };
    load();
    const unsubscribe = subscribeActivity(load);
    const timer = window.setInterval(load, 60_000);
    return () => {
      stop = true;
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [view.network]);

  if (!items.length) return null;
  const visible = all ? items : items.slice(0, ACTIVITY_PREVIEW);

  return (
    <Panel className="mt-4" padding="card">
      <p className="text-[13px] text-faint">Recent</p>
      <ul className="mt-3 grid gap-3">
        {visible.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate text-[14px] text-text">{item.title}</span>
              <span className="text-[12px] text-faint">{when(item.at)}</span>
            </span>
            <span className="shrink-0 font-mono text-[13px] text-muted">{item.detail}</span>
          </li>
        ))}
      </ul>
      {items.length > ACTIVITY_PREVIEW ? (
        <button type="button" className="mt-3 text-[13px] text-muted hover:text-gold" onClick={() => setAll((open) => !open)}>
          {all ? "Show less" : "See all"}
        </button>
      ) : null}
    </Panel>
  );
}
