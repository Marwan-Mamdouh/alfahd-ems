// src/providers/query-provider.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState عشان الـ client يتعمل مرة واحدة لكل session (مش مع كل render)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // الدقيقة دي مش بنضغط على الـ API
            retry: 1, // نجرب مرة واحدة قبل ما نظهر error
            refetchOnWindowFocus: false, // مش محتاجينها في dashboard إداري
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
