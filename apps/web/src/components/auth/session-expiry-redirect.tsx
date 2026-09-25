"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SESSION_EXPIRED_EVENT } from "@/core/auth/auth-events";
import { LOGIN_PATH } from "@/core/auth/routes";

export function SessionExpiryRedirect() {
  const router = useRouter();

  useEffect(() => {
    const handleSessionExpired = () => {
      router.replace(LOGIN_PATH);
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);

    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, [router]);

  return null;
}