"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { CopyField } from "@/components/CopyField";

export function QRPay({ uri, caption }: { uri: string; caption: string }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let cancel = false;
    QRCode.toDataURL(uri, {
      margin: 1,
      width: 232,
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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      {src ? <img src={src} alt="Payment QR" width={232} height={232} className="rounded-lg" /> : null}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-muted">{caption}</p>
        <div className="mt-3">
          <CopyField label="Payment URI" value={uri} />
        </div>
      </div>
    </div>
  );
}
