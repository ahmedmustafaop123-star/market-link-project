"use client";

import { useRouter } from "next/navigation";

export function MarkAllRead() {
  const router = useRouter();
  return (
    <button className="btn-secondary" onClick={async () => { await fetch("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: "{}" }); router.refresh(); }}>
      ✓ Mark all read
    </button>
  );
}
