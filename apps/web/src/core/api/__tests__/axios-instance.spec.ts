import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import {
  api,
  unwrap,
  downloadBlob,
  clearSessionAndBroadcast,
} from "../axios-instance";
import { useAuthStore } from "@/core/auth/auth.store";
import { ENDPOINTS } from "../endpoints";
import {
  SESSION_EXPIRED_EVENT,
} from "@/core/auth/auth-events";

describe("Axios instance and interceptors", () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    useAuthStore.getState().clearSession();
    vi.unstubAllGlobals();
  });

  describe("unwrap helper", () => {
    it("extracts data property from standard ApiResponse envelope", () => {
      const response = {
        data: {
          data: { id: "123", name: "Test Item" },
        },
      };

      const result = unwrap(response);
      expect(result).toEqual({ id: "123", name: "Test Item" });
    });
  });

  describe("Request interceptor", () => {
    it("attaches Authorization header when accessToken exists in store", async () => {
      useAuthStore.getState().setSession("test-token-xyz", null);

      let capturedConfig: InternalAxiosRequestConfig | undefined;
      const testAdapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        capturedConfig = config;
        return {
          data: { data: "ok" },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };

      api.defaults.adapter = testAdapter;

      await api.get("/warehouses");

      expect(capturedConfig).toBeDefined();
      expect(capturedConfig?.headers?.Authorization).toBe("Bearer test-token-xyz");
    });

    it("omits Authorization header for unauthenticated endpoints", async () => {
      useAuthStore.getState().setSession("test-token-xyz", null);

      let capturedConfig: InternalAxiosRequestConfig | undefined;
      const testAdapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        capturedConfig = config;
        return {
          data: { data: "ok" },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };

      api.defaults.adapter = testAdapter;

      await api.post(ENDPOINTS.auth.login, { email: "test@example.com", password: "123" });

      expect(capturedConfig).toBeDefined();
      expect(capturedConfig?.headers?.Authorization).toBeUndefined();
    });

    it("strips Content-Type: application/json when request data is FormData", async () => {
      let capturedConfig: InternalAxiosRequestConfig | undefined;
      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        capturedConfig = config;
        return {
          data: { data: "uploaded" },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };

      const formData = new FormData();
      formData.append("file", "dummy-content");

      await api.post("/ip-addresses/import", formData);

      expect(capturedConfig).toBeDefined();
      expect(capturedConfig?.headers.get("Content-Type")).not.toBe("application/json");
      expect(capturedConfig?.data).toBe(formData);
    });
  });

  describe("downloadBlob helper", () => {
    it("requests with responseType: blob and returns response data", async () => {
      const mockBlob = new Blob(["mock-excel-binary"], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      let capturedConfig: InternalAxiosRequestConfig | undefined;
      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        capturedConfig = config;
        return {
          data: mockBlob,
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };

      const result = await downloadBlob("/jobs/job-1/download");

      expect(capturedConfig?.responseType).toBe("blob");
      expect(result).toBe(mockBlob);
    });
  });

  describe("clearSessionAndBroadcast", () => {
    it("clears user and token in store", () => {
      useAuthStore.getState().setSession("active-token", null);
      expect(useAuthStore.getState().accessToken).toBe("active-token");

      clearSessionAndBroadcast();

      expect(useAuthStore.getState().accessToken).toBeNull();
    });

    it("dispatches SESSION_EXPIRED_EVENT when window is present", () => {
      useAuthStore.getState().setSession("active-token", null);

      const dispatchSpy = vi.fn();
      vi.stubGlobal("window", {
        dispatchEvent: dispatchSpy,
      });

      clearSessionAndBroadcast();

      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(dispatchSpy).toHaveBeenCalledWith(expect.any(Event));
      const dispatchedEvent = dispatchSpy.mock.calls[0][0] as Event;
      expect(dispatchedEvent.type).toBe(SESSION_EXPIRED_EVENT);
    });
  });

  describe("401 single-flight refresh", () => {
    it("deduplicates concurrent 401 requests into a single refresh call and replays requests", async () => {
      useAuthStore.getState().setSession("expired-token", null);

      const axiosPostSpy = vi.spyOn(axios, "post").mockImplementation(async (url) => {
        if (url === ENDPOINTS.auth.refresh) {
          return {
            data: {
              data: { accessToken: "brand-new-token" },
            },
          } as AxiosResponse;
        }
        throw new Error("Unexpected post URL");
      });

      let callCount = 0;
      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        callCount++;
        // If request has the expired token, fail with 401
        if (config.headers.Authorization === "Bearer expired-token") {
          throw new AxiosError("Unauthorized", "401", config, null, {
            status: 401,
            statusText: "Unauthorized",
            data: { message: "Token expired" },
            headers: {},
            config,
          });
        }

        // Retried call with new token succeeds
        return {
          data: { data: `ok-with-${config.headers.Authorization}` },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };

      // Fire 2 concurrent requests that fail with 401
      const [res1, res2] = await Promise.all([
        api.get<{ data: string }>("/warehouses"),
        api.get<{ data: string }>("/products"),
      ]);

      expect(res1.data.data).toBe("ok-with-Bearer brand-new-token");
      expect(res2.data.data).toBe("ok-with-Bearer brand-new-token");
      // axios.post to /auth/refresh was called EXACTLY ONCE (single-flight deduplication)
      expect(axiosPostSpy).toHaveBeenCalledTimes(1);
      // Adapter was called 4 times: 2 initial 401s + 2 retried calls
      expect(callCount).toBe(4);
      // New access token saved in store
      expect(useAuthStore.getState().accessToken).toBe("brand-new-token");
    });

    it("clears session and rejects when refresh fails", async () => {
      useAuthStore.getState().setSession("expired-token", null);

      vi.spyOn(axios, "post").mockRejectedValue(new Error("Refresh network failure"));

      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        throw new AxiosError("Unauthorized", "401", config, null, {
          status: 401,
          statusText: "Unauthorized",
          data: {},
          headers: {},
          config,
        });
      };

      await expect(api.get("/warehouses")).rejects.toThrow();
      expect(useAuthStore.getState().accessToken).toBeNull();
    });
  });

  describe("Response interceptor retry policies", () => {
    it("retries transient 5xx errors for GET requests", async () => {
      let attempts = 0;
      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        attempts++;
        if (attempts < 2) {
          throw new AxiosError("Server Error", "500", config, null, {
            status: 500,
            statusText: "Internal Server Error",
            data: {},
            headers: {},
            config,
          });
        }
        return {
          data: { data: "success-after-retry" },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };

      const res = await api.get<{ data: string }>("/warehouses");
      expect(res.data.data).toBe("success-after-retry");
      expect(attempts).toBe(2);
    });

    it("does not retry mutations (POST/PATCH/DELETE) on 500 error", async () => {
      let attempts = 0;
      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        attempts++;
        throw new AxiosError("Server Error", "500", config, null, {
          status: 500,
          statusText: "Internal Server Error",
          data: {},
          headers: {},
          config,
        });
      };

      await expect(
        api.post("/inventory/inbound", { productId: "p1", warehouseId: "w1", quantity: 10 })
      ).rejects.toThrow("Server Error");

      expect(attempts).toBe(1); // Never retried
    });

    it("does not retry 4xx client errors on GET", async () => {
      let attempts = 0;
      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        attempts++;
        throw new AxiosError("Not Found", "404", config, null, {
          status: 404,
          statusText: "Not Found",
          data: {},
          headers: {},
          config,
        });
      };

      await expect(api.get("/warehouses/non-existent")).rejects.toThrow("Not Found");
      expect(attempts).toBe(1);
    });
  });
});
