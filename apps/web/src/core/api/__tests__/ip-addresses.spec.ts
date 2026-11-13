import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { api } from "../axios-instance";
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
} from "../ip-addresses";
import type { IpAddressDto, IpHistoryDto } from "../types";

describe("IP Addresses API Client Functions (Task B6)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockIp: IpAddressDto = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    address: "192.168.1.100",
    status: "FREE",
    isArchived: false,
    customerId: null,
    notes: "Core gateway",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  it("fetchIpAddresses sends correct query params to /ip-addresses", async () => {
    let capturedUrl = "";
    let capturedParams: Record<string, unknown> = {};

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedUrl = config.url ?? "";
      capturedParams = (config.params as Record<string, unknown>) ?? {};
      return {
        data: {
          data: {
            items: [mockIp],
            total: 1,
          },
        },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const result = await fetchIpAddresses({
      page: 2,
      limit: 10,
      status: "FREE",
      isArchived: false,
      search: "192.168",
    });

    expect(capturedUrl).toBe("/ip-addresses");
    expect(capturedParams).toEqual({
      page: 2,
      limit: 10,
      status: "FREE",
      isArchived: false,
      search: "192.168",
    });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
  });

  it("fetchIpAddressById queries /ip-addresses/:id", async () => {
    let capturedUrl = "";

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedUrl = config.url ?? "";
      return {
        data: { data: mockIp },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const result = await fetchIpAddressById(mockIp.id);
    expect(capturedUrl).toBe(`/ip-addresses/${mockIp.id}`);
    expect(result.address).toBe("192.168.1.100");
  });

  it("createIpAddress sends POST to /ip-addresses with body", async () => {
    let capturedMethod = "";
    let capturedUrl = "";
    let capturedBody: unknown = null;

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedMethod = config.method ?? "";
      capturedUrl = config.url ?? "";
      capturedBody = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
      return {
        data: { data: mockIp },
        status: 201,
        statusText: "Created",
        headers: {},
        config,
      };
    };

    const result = await createIpAddress({ address: "192.168.1.100", notes: "Core gateway" });
    expect(capturedMethod.toUpperCase()).toBe("POST");
    expect(capturedUrl).toBe("/ip-addresses");
    expect(capturedBody).toEqual({ address: "192.168.1.100", notes: "Core gateway" });
    expect(result.status).toBe("FREE");
  });

  it("updateIpAddress sends PATCH to /ip-addresses/:id with body", async () => {
    let capturedMethod = "";
    let capturedUrl = "";
    let capturedBody: unknown = null;

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedMethod = config.method ?? "";
      capturedUrl = config.url ?? "";
      capturedBody = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
      return {
        data: { data: { ...mockIp, notes: "Updated note" } },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const result = await updateIpAddress(mockIp.id, { notes: "Updated note" });
    expect(capturedMethod.toUpperCase()).toBe("PATCH");
    expect(capturedUrl).toBe(`/ip-addresses/${mockIp.id}`);
    expect(capturedBody).toEqual({ notes: "Updated note" });
    expect(result.notes).toBe("Updated note");
  });

  it("reserveIpAddress sends POST to /ip-addresses/:id/reserve", async () => {
    let capturedUrl = "";
    let capturedBody: unknown = null;

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedUrl = config.url ?? "";
      capturedBody = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
      return {
        data: { data: { ...mockIp, status: "RESERVED" } },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const result = await reserveIpAddress(mockIp.id, "Customer assignment");
    expect(capturedUrl).toBe(`/ip-addresses/${mockIp.id}/reserve`);
    expect(capturedBody).toEqual({ reason: "Customer assignment" });
    expect(result.status).toBe("RESERVED");
  });

  it("releaseIpAddress sends POST to /ip-addresses/:id/release", async () => {
    let capturedUrl = "";
    let capturedBody: unknown = null;

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedUrl = config.url ?? "";
      capturedBody = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
      return {
        data: { data: { ...mockIp, status: "FREE" } },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const result = await releaseIpAddress(mockIp.id, "Contract ended");
    expect(capturedUrl).toBe(`/ip-addresses/${mockIp.id}/release`);
    expect(capturedBody).toEqual({ reason: "Contract ended" });
    expect(result.status).toBe("FREE");
  });

  it("archiveIpAddress sends POST to /ip-addresses/:id/archive", async () => {
    let capturedUrl = "";
    let capturedBody: unknown = null;

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedUrl = config.url ?? "";
      capturedBody = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
      return {
        data: { data: { ...mockIp, isArchived: true } },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const result = await archiveIpAddress(mockIp.id, "Subnet decommissioned");
    expect(capturedUrl).toBe(`/ip-addresses/${mockIp.id}/archive`);
    expect(capturedBody).toEqual({ reason: "Subnet decommissioned" });
    expect(result.isArchived).toBe(true);
  });

  it("unarchiveIpAddress sends POST to /ip-addresses/:id/unarchive", async () => {
    let capturedUrl = "";

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedUrl = config.url ?? "";
      return {
        data: { data: { ...mockIp, isArchived: false } },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const result = await unarchiveIpAddress(mockIp.id);
    expect(capturedUrl).toBe(`/ip-addresses/${mockIp.id}/unarchive`);
    expect(result.isArchived).toBe(false);
  });

  it("fetchIpHistory queries /ip-addresses/:id/history", async () => {
    let capturedUrl = "";
    const mockHistory: IpHistoryDto[] = [
      {
        id: "hist-1",
        ipId: mockIp.id,
        action: "CREATE",
        fromStatus: "FREE",
        toStatus: "FREE",
        reason: "Initial registration",
        metadataBefore: null,
        metadataAfter: { notes: "Core gateway" },
        actorId: "admin-1",
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedUrl = config.url ?? "";
      return {
        data: { data: mockHistory },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const result = await fetchIpHistory(mockIp.id);
    expect(capturedUrl).toBe(`/ip-addresses/${mockIp.id}/history`);
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("CREATE");
  });
});

