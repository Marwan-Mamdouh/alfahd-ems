"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SESSION_EXPIRED_EVENT } from "@/core/auth/auth-events";

export function SessionExpiryRedirect() {
  const router = useRouter();

  useEffect(() => {
    const handleSessionExpired = () => {
      router.replace("/auth/login");
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);

    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, [router]);

  return null;
}