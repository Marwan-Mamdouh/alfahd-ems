"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface StatusBadgeConfig {
  label: string;
  className: string;
  icon?: React.ComponentType<{ className?: string }>;
  dotClassName?: string;
}

export interface StatusBadgeProps {
  config: StatusBadgeConfig;
  className?: string;
  "data-testid"?: string;
}

/**
 * Shared config-driven status pill badge (follow-up-plan.md T-5).
 */
export function StatusBadge({
  config,
  className,
  "data-testid": testId,
}: StatusBadgeProps) {
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        config.className,
        className
      )}
      data-testid={testId}
    >
      {Icon ? (
        <Icon className="size-3.5 shrink-0" />
      ) : config.dotClassName ? (
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dotClassName)} />
      ) : null}
      <span>{config.label}</span>
    </span>
  );
}
