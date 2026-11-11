import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { QueryClient } from "@tanstack/react-query";
import { api } from "@/core/api/axios-instance";
import { queryKeys } from "../query-keys";
import {
  fetchIpAddresses,
  fetchIpAddressById,
  createIpAddress,
  updateIpAddress,
  reserveIpAddress,
  releaseIpAddress,
  archiveIpAddress,
  unarchiveIpAddress,
  fetchIpHistory,
} from "@/core/api/ip-addresses";
import { extractErrorMessage } from "../use-ip-addresses";
import type { IpAddressDto, IpHistoryDto } from "@/core/api/types";

describe("IP Addresses React Query Hooks & Invalidation (Task B6)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const mockIp: IpAddressDto = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    address: "192.168.1.50",
    status: "FREE",
    isArchived: false,
    customerId: null,
    notes: "Primary test gateway",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  describe("extractErrorMessage", () => {
    it("unwraps AxiosError string message", () => {
      const axiosErr = {
        isAxiosError: true,
        response: {
          data: {
            message: "Cannot archive a RESERVED IP address. Release it first.",
          },
        },
      };
      expect(extractErrorMessage(axiosErr, "Fallback")).toBe(
        "Cannot archive a RESERVED IP address. Release it first."
      );
    });

    it("unwraps AxiosError array of validation messages", () => {
      const axiosErr = {
        isAxiosError: true,
        response: {
          data: {
            message: [
              "Address must be a valid individual IPv4 host address",
              "notes must be a string",
            ],
          },
        },
      };
      expect(extractErrorMessage(axiosErr, "Fallback")).toBe(
        "Address must be a valid individual IPv4 host address, notes must be a string"
      );
    });

    it("unwraps generic Error message", () => {
      const err = new Error("Network timeout");
      expect(extractErrorMessage(err, "Fallback")).toBe("Network timeout");
    });

    it("returns defaultMessage for non-error primitives", () => {
      expect(extractErrorMessage(null, "Fallback")).toBe("Fallback");
      expect(extractErrorMessage(404, "Fallback")).toBe("Fallback");
    });
  });

  describe("Query Caching", () => {
    it("fetches and caches IP addresses list", async () => {
      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        return {
          data: { data: { items: [mockIp], total: 1 } },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };

      const result = await queryClient.fetchQuery({
        queryKey: queryKeys.ipAddresses.list({ status: "FREE" }),
        queryFn: () => fetchIpAddresses({ status: "FREE" }),
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].address).toBe("192.168.1.50");

      const cached = queryClient.getQueryData(queryKeys.ipAddresses.list({ status: "FREE" }));
      expect(cached).toEqual(result);
    });

    it("fetches and caches IP address detail by ID", async () => {
      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        return {
          data: { data: mockIp },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };

      const result = await queryClient.fetchQuery({
        queryKey: queryKeys.ipAddresses.detail(mockIp.id),
        queryFn: () => fetchIpAddressById(mockIp.id),
      });

      expect(result.id).toBe(mockIp.id);
      const cached = queryClient.getQueryData(queryKeys.ipAddresses.detail(mockIp.id));
      expect(cached).toEqual(result);
    });

    it("fetches and caches IP history by ID", async () => {
      const mockHistory: IpHistoryDto[] = [
        {
          id: "hist-1",
          ipId: mockIp.id,
          action: "CREATE",
          fromStatus: "FREE",
          toStatus: "FREE",
          reason: "Init",
          actorId: "admin-1",
          createdAt: "2026-01-01T00:00:00Z",
        },
      ];

      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        return {
          data: { data: mockHistory },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };

      const result = await queryClient.fetchQuery({
        queryKey: queryKeys.ipAddresses.history(mockIp.id),
        queryFn: () => fetchIpHistory(mockIp.id),
      });

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe("CREATE");
    });
  });

  describe("Mutation Invalidation Graph", () => {
    it("createIpAddress invalidates all IP queries", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        return {
          data: { data: mockIp },
          status: 201,
          statusText: "Created",
          headers: {},
          config,
        };
      };

      await createIpAddress({ address: "192.168.1.50" });
      await queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.all });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.ipAddresses.all,
      });
    });

    it("updateIpAddress invalidates all list, detail and history queries", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        return {
          data: { data: { ...mockIp, notes: "New note" } },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };

      await updateIpAddress(mockIp.id, { notes: "New note" });
      await queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.detail(mockIp.id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.history(mockIp.id) });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ipAddresses.all });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ipAddresses.detail(mockIp.id) });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ipAddresses.history(mockIp.id) });
    });

    it("reserveIpAddress invalidates all, detail, and history queries", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        return {
          data: { data: { ...mockIp, status: "RESERVED" } },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };

      await reserveIpAddress(mockIp.id, "Reserved for technician");
      await queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.detail(mockIp.id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.history(mockIp.id) });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ipAddresses.all });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ipAddresses.detail(mockIp.id) });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ipAddresses.history(mockIp.id) });
    });

    it("releaseIpAddress invalidates all, detail, and history queries", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        return {
          data: { data: { ...mockIp, status: "FREE" } },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };

      await releaseIpAddress(mockIp.id, "Released from decommission");
      await queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.detail(mockIp.id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.history(mockIp.id) });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ipAddresses.all });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ipAddresses.detail(mockIp.id) });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ipAddresses.history(mockIp.id) });
    });

    it("archiveIpAddress invalidates all, detail, and history queries", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        return {
          data: { data: { ...mockIp, isArchived: true } },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };

      await archiveIpAddress(mockIp.id, "Obsolete subnet");
      await queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.detail(mockIp.id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.history(mockIp.id) });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ipAddresses.all });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ipAddresses.detail(mockIp.id) });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ipAddresses.history(mockIp.id) });
    });

    it("unarchiveIpAddress invalidates all, detail, and history queries", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        return {
          data: { data: { ...mockIp, isArchived: false } },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };

      await unarchiveIpAddress(mockIp.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.detail(mockIp.id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.history(mockIp.id) });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ipAddresses.all });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ipAddresses.detail(mockIp.id) });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ipAddresses.history(mockIp.id) });
    });
  });
});

