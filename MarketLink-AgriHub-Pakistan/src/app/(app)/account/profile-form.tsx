"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, Spinner } from "@/components/ui";
import { CityOptions } from "@/components/city-options";
import { useToast } from "@/components/providers";

type P = { fullName: string; phone: string; city: string; businessName: string; cnicId: string; address: string };

export function ProfileForm({ initial, highlight }: { initial: P; highlight: boolean }) {
  const router = useRouter();
  const { push } = useToast();
  const [f, setF] = useState<P>(initial);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof P) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/account/profile", { method: "PATCH", json: { ...f, cnicId: f.cnicId || undefined, businessName: f.businessName || undefined, address: f.address || undefined } });
      push({ kind: "success", title: "Profile saved" });
      router.refresh();
    } catch (err) {
      push({ kind: "error", title: "Couldn't save profile", body: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className={`card grid grid-cols-2 gap-3 p-6 ${highlight ? "ring-2 ring-amber-400" : ""}`}>
      <h2 className="col-span-2 font-bold">Profile</h2>
      <div className="col-span-2"><label className="label">Full name</label><input className="input" required value={f.fullName} onChange={set("fullName")} /></div>
      <div className="col-span-2 sm:col-span-1"><label className="label">Mobile number</label><input className="input" required value={f.phone} onChange={set("phone")} placeholder="03xx xxxxxxx" /></div>
      <div className="col-span-2 sm:col-span-1"><label className="label">City</label><select className="input" required value={f.city} onChange={set("city")}><option value="" disabled>Select city…</option><CityOptions /></select></div>
      <div className="col-span-2 sm:col-span-1"><label className="label">Business / farm name</label><input className="input" value={f.businessName} onChange={set("businessName")} /></div>
      <div className="col-span-2 sm:col-span-1"><label className="label">CNIC</label><input className="input" value={f.cnicId} onChange={set("cnicId")} placeholder="12345-1234567-1" /></div>
      <div className="col-span-2"><label className="label">Address</label><input className="input" value={f.address} onChange={set("address")} /></div>
      <div className="col-span-2 flex justify-end"><button className="btn-primary" disabled={busy}>{busy && <Spinner />} Save profile</button></div>
    </form>
  );
}
