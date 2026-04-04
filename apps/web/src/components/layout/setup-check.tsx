"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { useStore } from "@/hooks/use-store";

export function SetupCheck() {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const setRuntime = useStore((s) => s.setRuntime);

  useEffect(() => {
    // Fetch runtime mode from health API (always, even on setup page)
    api
      .getHealth()
      .then((res) => {
        if (res.runtime) {
          setRuntime(res.runtime);
        }
      })
      .catch(() => {});

    // Don't redirect if already on setup page
    if (pathname === "/setup") {
      setChecked(true);
      return;
    }

    api
      .getSetupStatus()
      .then((res) => {
        if (!res.isSetUp) {
          router.replace("/setup");
        }
      })
      .catch(() => {
        // API not reachable — don't redirect, let user see the dashboard
      })
      .finally(() => setChecked(true));
  }, [pathname, router, setRuntime]);

  return null;
}
