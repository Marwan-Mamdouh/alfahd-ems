import { describe, it, expect } from "vitest";
import {
  httpStatus,
  retryAfterSeconds,
  serverMessage,
  extractErrorMessage,
} from "../errors";

describe("errors helper functions", () => {
  describe("httpStatus", () => {
    it("returns response status code for Axios errors", () => {
      const err = { isAxiosError: true, response: { status: 409 } };
      expect(httpStatus(err)).toBe(409);
    });

    it("returns undefined for network errors with no response", () => {
      const err = { isAxiosError: true };
      expect(httpStatus(err)).toBeUndefined();
    });

    it("returns undefined for non-Axios errors", () => {
      expect(httpStatus(new Error("Oops"))).toBeUndefined();
      expect(httpStatus(null)).toBeUndefined();
      expect(httpStatus("some string")).toBeUndefined();
    });
  });

  describe("retryAfterSeconds", () => {
    it("parses valid positive integer retry-after headers", () => {
      const err = {
        isAxiosError: true,
        response: { headers: { "retry-after": "60" } },
      };
      expect(retryAfterSeconds(err)).toBe(60);
    });

    it("returns null if retry-after is absent, non-numeric, or non-positive", () => {
      expect(
        retryAfterSeconds({ isAxiosError: true, response: { headers: {} } })
      ).toBeNull();
      expect(
        retryAfterSeconds({
          isAxiosError: true,
          response: { headers: { "retry-after": "invalid" } },
        })
      ).toBeNull();
      expect(
        retryAfterSeconds({
          isAxiosError: true,
          response: { headers: { "retry-after": "-5" } },
        })
      ).toBeNull();
      expect(retryAfterSeconds(new Error("Network fail"))).toBeNull();
    });
  });

  describe("serverMessage", () => {
    it("extracts string message from axios error data", () => {
      const err = {
        isAxiosError: true,
        response: { data: { message: "Unauthorized access" } },
      };
      expect(serverMessage(err)).toBe("Unauthorized access");
    });

    it("joins array messages with Arabic comma", () => {
      const err = {
        isAxiosError: true,
        response: { data: { message: ["خطأ أول", "خطأ ثان"] } },
      };
      expect(serverMessage(err)).toBe("خطأ أول، خطأ ثان");
    });

    it("returns null for non-Axios or missing messages", () => {
      expect(serverMessage(new Error("Generic"))).toBeNull();
      expect(serverMessage({ isAxiosError: true, response: { data: {} } })).toBeNull();
    });
  });

  describe("extractErrorMessage", () => {
    it("extracts single string message from AxiosError data", () => {
      const err = {
        isAxiosError: true,
        response: {
          data: {
            message: "Cannot deactivate warehouse due to active inventory",
          },
        },
      };
      expect(extractErrorMessage(err, "Default fallback")).toBe(
        "Cannot deactivate warehouse due to active inventory"
      );
    });

    it("joins array of validation messages with standard comma and space", () => {
      const err = {
        isAxiosError: true,
        response: {
          data: {
            message: [
              "Serial number is required",
              "Warehouse ID must be a valid UUID",
            ],
          },
        },
      };
      expect(extractErrorMessage(err, "Default fallback")).toBe(
        "Serial number is required, Warehouse ID must be a valid UUID"
      );
    });

    it("extracts message from standard Error instance", () => {
      const err = new Error("Network timeout during fetch");
      expect(extractErrorMessage(err, "Default fallback")).toBe(
        "Network timeout during fetch"
      );
    });

    it("falls back to defaultMessage when error is unknown or empty object", () => {
      expect(extractErrorMessage({}, "Default fallback")).toBe("Default fallback");
      expect(extractErrorMessage(null, "Default fallback")).toBe("Default fallback");
      expect(extractErrorMessage(undefined, "Default fallback")).toBe("Default fallback");
      expect(extractErrorMessage(500, "Default fallback")).toBe("Default fallback");
    });
  });
});

