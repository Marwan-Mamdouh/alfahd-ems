/**
 * Domain rules, validation functions, and action eligibility logic for IPv4 management.
 * Free of JSX to enable isolated unit testing in both Node.js and browser environments.
 */

import type { IpActionType, IpCapabilities, IpStatus } from "./types";

export const IPV4_REGEX =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MiB
export const MAX_ROWS_LIMIT = 5000;

/**
 * Validates whether an input string is a valid single IPv4 host address.
 * Strictly rejects CIDR notation (e.g., /24), IPv6 addresses, and out-of-range octets.
 */
export function validateIpv4Address(address: string): string | null {
  const trimmed = address.trim();
  if (!trimmed) {
    return "عنوان IP مطلوب.";
  }
  if (trimmed.includes("/")) {
    return "يجب إدخال عنوان IPv4 فردي فقط، وتنسيق CIDR (مثل /24) غير مسموح.";
  }
  if (trimmed.includes(":")) {
    return "عناوين IPv6 غير مدعومة، يرجى إدخال عنوان IPv4 صحيح.";
  }
  if (!IPV4_REGEX.test(trimmed)) {
    return "صيغة عنوان IPv4 غير صحيحة (مثال صحيح: 192.168.1.10).";
  }
  return null;
}

/**
 * Validates an uploaded CSV file against size and extension constraints.
 */
export function validateCsvFile(file: { name: string; size: number }): string | null {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return "يرجى اختيار ملف بصيغة CSV (.csv) فقط.";
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "حجم الملف يتجاوز الحد الأقصى المسموح به (5 ميجابايت). يرجى تقليص حجم الملف.";
  }
  return null;
}

/**
 * Determines whether a given action is valid for the IP's current status and archival state.
 * Prevents archival conflicts (e.g. archiving a RESERVED IP) and invalid state transitions.
 */
export function validateIpActionEligibility(
  action: IpActionType,
  ip: { status: IpStatus; isArchived: boolean }
): { allowed: boolean; reason?: string } {
  switch (action) {
    case "reserve":
      if (ip.isArchived) {
        return {
          allowed: false,
          reason: "لا يمكن حجز عنوان مؤرشف. يجب استعادة العنوان من الأرشيف أولاً.",
        };
      }
      if (ip.status === "RESERVED") {
        return { allowed: false, reason: "العنوان محجوز بالفعل." };
      }
      return { allowed: true };

    case "release":
      if (ip.isArchived) {
        return {
          allowed: false,
          reason: "لا يمكن تحرير عنوان مؤرشف.",
        };
      }
      if (ip.status === "FREE") {
        return { allowed: false, reason: "العنوان متاح بالفعل وغير محجوز." };
      }
      return { allowed: true };

    case "archive":
      if (ip.isArchived) {
        return { allowed: false, reason: "العنوان مؤرشف بالفعل." };
      }
      if (ip.status === "RESERVED") {
        return {
          allowed: false,
          reason:
            "تعارض في الأرشفة: لا يمكن أرشفة عنوان محجوز (RESERVED). يجب تحرير العنوان أولاً.",
        };
      }
      return { allowed: true };

    case "unarchive":
      if (!ip.isArchived) {
        return { allowed: false, reason: "العنوان غير مؤرشف بالفعل." };
      }
      return { allowed: true };
  }
}

export interface RowActionAvailability {
  canEdit: boolean;
  canReserve: boolean;
  canRelease: boolean;
  canArchive: boolean;
  canUnarchive: boolean;
  canViewHistory: boolean;
}

/**
 * Calculates which table actions should be visible and enabled for a specific row,
 * taking into account both user capabilities and domain status constraints.
 */
export function getAvailableRowActions(
  ip: { status: IpStatus; isArchived: boolean },
  capabilities: Partial<IpCapabilities>
): RowActionAvailability {
  return {
    canEdit: !!capabilities.edit,
    canReserve: !!capabilities.reserve && ip.status === "FREE" && !ip.isArchived,
    canRelease: !!capabilities.reserve && ip.status === "RESERVED" && !ip.isArchived,
    canArchive: !!capabilities.archive && ip.status === "FREE" && !ip.isArchived,
    canUnarchive: !!capabilities.archive && ip.isArchived,
    canViewHistory: !!capabilities.history,
  };
}
