import { describe, it, expect, vi, beforeEach } from "vitest";
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { api, unwrap } from "../axios-instance";
import { httpStatus, serverMessage } from "../errors";
import { useAuthStore } from "@/core/auth/auth.store";

describe("API Contract & Envelope Specifications", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Success Envelope", () => {
    it("backend wraps every response in { data: <payload> } without success/message flags", async () => {
      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        return {
          data: {
            data: { id: "p-1", name: "Router AC", sku: "RTR-AC-01" },
          },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };

      const response = await api.get("/products/p-1");
      expect(response.data).toHaveProperty("data");
      expect((response.data as Record<string, unknown>).success).toBeUndefined();
      expect((response.data as Record<string, unknown>).message).toBeUndefined();

      const unwrapped = unwrap(response);
      expect(unwrapped).toEqual({ id: "p-1", name: "Router AC", sku: "RTR-AC-01" });
    });
  });

  describe("Error Envelopes & Responses", () => {
    it("handles 400 Validation Error envelope with array message", async () => {
      let attempts = 0;
      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        attempts++;
        throw new AxiosError("Bad Request", "400", config, null, {
          status: 400,
          statusText: "Bad Request",
          data: {
            statusCode: 400,
            message: ["Warehouse name is required", "Physical address is required"],
            path: "/warehouses",
            timestamp: "2026-11-10T20:00:00.000Z",
          },
          headers: {},
          config,
        });
      };

      try {
        await api.post("/warehouses", {});
        expect.unreachable("Should have thrown 400 error");
      } catch (err) {
        expect(httpStatus(err)).toBe(400);
        expect(serverMessage(err)).toBe("Warehouse name is required، Physical address is required");
        expect(attempts).toBe(1); // 400 is a settled client error, never retried
      }
    });

    it("handles 403 Forbidden error envelope without retrying", async () => {
      let attempts = 0;
      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        attempts++;
        throw new AxiosError("Forbidden", "403", config, null, {
          status: 403,
          statusText: "Forbidden",
          data: {
            statusCode: 403,
            message: "Forbidden resource",
            path: "/warehouses/wh-1",
            timestamp: "2026-11-10T20:00:00.000Z",
          },
          headers: {},
          config,
        });
      };

      try {
        await api.delete("/warehouses/wh-1");
        expect.unreachable("Should have thrown 403 error");
      } catch (err) {
        expect(httpStatus(err)).toBe(403);
        expect(serverMessage(err)).toBe("Forbidden resource");
        expect(attempts).toBe(1); // 403 is never retried
      }
    });

    it("handles 409 Conflict error envelope preserving conflict message without retrying", async () => {
      let attempts = 0;
      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        attempts++;
        throw new AxiosError("Conflict", "409", config, null, {
          status: 409,
          statusText: "Conflict",
          data: {
            statusCode: 409,
            message: 'Warehouse with name "Cairo Central" already exists',
            path: "/warehouses",
            timestamp: "2026-11-10T20:00:00.000Z",
          },
          headers: {},
          config,
        });
      };

      try {
        await api.post("/warehouses", { name: "Cairo Central" });
        expect.unreachable("Should have thrown 409 error");
      } catch (err) {
        expect(httpStatus(err)).toBe(409);
        expect(serverMessage(err)).toBe('Warehouse with name "Cairo Central" already exists');
        expect(attempts).toBe(1);
      }
    });
  });

  describe("Security and Relative Route Guarantees", () => {
    it("pins baseURL to relative /api ensuring proxy rewrite and httpOnly cookie flow", () => {
      expect(api.defaults.baseURL).toBe("/api");
      // Must not leak internal host or protocol
      expect(api.defaults.baseURL).not.toContain("http://");
      expect(api.defaults.baseURL).not.toContain("https://");
    });

    it("does not expose NEXT_PUBLIC_API_URL into public client bundles", () => {
      expect(process.env.NEXT_PUBLIC_API_URL).toBeUndefined();
    });

    it("stores access tokens in-memory only and never persists to browser storage", () => {
      const mockStorage: Record<string, string> = {};
      const storageMock = {
        getItem: (k: string) => mockStorage[k] ?? null,
        setItem: (k: string, v: string) => {
          mockStorage[k] = v;
        },
        removeItem: (k: string) => {
          delete mockStorage[k];
        },
        clear: () => {
          for (const k of Object.keys(mockStorage)) delete mockStorage[k];
        },
      };

      vi.stubGlobal("localStorage", storageMock);
      vi.stubGlobal("sessionStorage", storageMock);

      try {
        useAuthStore.getState().setSession("confidential-token-12345", null);

        expect(useAuthStore.getState().accessToken).toBe("confidential-token-12345");
        // Storage must remain completely empty
        expect(Object.keys(mockStorage)).toHaveLength(0);
        expect(storageMock.getItem("token")).toBeNull();
        expect(storageMock.getItem("accessToken")).toBeNull();
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });
});

