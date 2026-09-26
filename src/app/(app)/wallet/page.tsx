import { requirePageUser } from "@/lib/auth";
import { Suspense } from "react";
import { WalletClient } from "./wallet-client";

export default async function WalletPage() {
  const user = await requirePageUser(["farmer", "buyer"]);
  return (
    <Suspense>
      <WalletClient role={user.role as "farmer" | "buyer"} />
    </Suspense>
  );
}
