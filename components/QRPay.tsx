"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { CopyField } from "@/components/CopyField";

export function QRPay({ uri, caption, address }: { uri: string; caption: string; address?: string }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let cancel = false;
    QRCode.toDataURL(uri, {
      margin: 1,
      width: 160,
      color: { dark: "#141311", light: "#ECE8E1" },
    })
      .then((url: string) => {
        if (!cancel) setSrc(url);
      })
      .catch(() => {
        if (!cancel) setSrc("");
      });
    return () => {
      cancel = true;
    };
  }, [uri]);

  return (
    <div className="grid min-w-0 gap-3">
      <CopyField label={address ? "Shielded ZEC address" : "Payment URI"} value={address ?? uri} />
      <div className="flex min-w-0 items-center gap-3">
        {src ? <img src={src} alt="Shielded ZEC deposit QR" width={160} height={160} className="h-40 w-40 shrink-0 rounded-lg" /> : null}
        <p className="min-w-0 text-[13px] leading-relaxed text-muted">{caption}</p>
      </div>
    </div>
  );
}
