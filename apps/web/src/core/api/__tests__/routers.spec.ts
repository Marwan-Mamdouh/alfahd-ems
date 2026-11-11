import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { api } from "../axios-instance";
import {
  fetchRouters,
  fetchRouterById,
  createRouter,
  assignRouter,
  transitionRouter,
  updateRouterCondition,
  fetchRouterAssignments,
  fetchRouterConditionHistory,
  fetchRouterStatusHistory,
} from "../routers";
import type {
  RouterDto,
  RouterAssignmentDto,
  RouterConditionHistoryDto,
  RouterStatusHistoryDto,
} from "../types";

describe("Routers API Client Functions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockRouter: RouterDto = {
    id: "router-1",
    serialNumber: "TPL-2026-00001",
    productId: "prod-1",
    status: "AVAILABLE",
    physicalCondition: "SERVICEABLE",
    warehouseId: "wh-1",
    externalLocation: null,
    currentHolderType: "WAREHOUSE",
    currentHolderId: "wh-1",
    notes: "Initial receipt",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    product: {
      id: "prod-1",
      name: "TP-Link Archer C6",
      sku: "RTR-TPL-C6",
      model: "Archer C6",
    },
    warehouse: {
      id: "wh-1",
      name: "Main Depot",
    },
  };

  it("fetchRouters queries /routers with limit and offset", async () => {
    let capturedUrl = "";
    let capturedParams: Record<string, unknown> = {};

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedUrl = config.url ?? "";
      capturedParams = (config.params as Record<string, unknown>) ?? {};
      return {
        data: {
          data: {
            items: [mockRouter],
            total: 1,
          },
        },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const result = await fetchRouters({ page: 2, limit: 10, status: "AVAILABLE" });
    expect(capturedUrl).toBe("/routers");
    expect(capturedParams.limit).toBe(10);
    expect(capturedParams.offset).toBe(10);
    expect(capturedParams.status).toBe("AVAILABLE");
    expect(result.items).toEqual([mockRouter]);
    expect(result.total).toBe(1);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
  });

  it("fetchRouterById queries /routers/:id", async () => {
    let capturedUrl = "";

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedUrl = config.url ?? "";
      return {
        data: { data: mockRouter },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const result = await fetchRouterById("router-1");
    expect(capturedUrl).toBe("/routers/router-1");
    expect(result).toEqual(mockRouter);
  });

  it("createRouter posts to /routers with isNewReceipt flag", async () => {
    let capturedUrl = "";
    let capturedData: unknown = null;

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedUrl = config.url ?? "";
      capturedData = JSON.parse(config.data as string);
      return {
        data: { data: mockRouter },
        status: 201,
        statusText: "Created",
        headers: {},
        config,
      };
    };

    const dto = {
      serialNumber: "TPL-2026-00001",
      productId: "prod-1",
      warehouseId: "wh-1",
      isNewReceipt: true,
      physicalCondition: "SERVICEABLE" as const,
      notes: "Batch delivery",
    };

    const result = await createRouter(dto);
    expect(capturedUrl).toBe("/routers");
    expect(capturedData).toEqual(dto);
    expect(result).toEqual(mockRouter);
  });

  it("assignRouter posts to /routers/:id/assign", async () => {
    let capturedUrl = "";
    let capturedData: unknown = null;

    const assignedRouter: RouterDto = {
      ...mockRouter,
      status: "ASSIGNED_TO_TECHNICIAN",
      currentHolderType: "TECHNICIAN",
      currentHolderId: "tech-1",
    };

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedUrl = config.url ?? "";
      capturedData = JSON.parse(config.data as string);
      return {
        data: { data: assignedRouter },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const dto = {
      technicianId: "tech-1",
      notes: "Issued for fiber job",
    };

    const result = await assignRouter("router-1", dto);
    expect(capturedUrl).toBe("/routers/router-1/assign");
    expect(capturedData).toEqual(dto);
    expect(result.status).toBe("ASSIGNED_TO_TECHNICIAN");
  });

  it("transitionRouter patches /routers/:id/transition", async () => {
    let capturedUrl = "";
    let capturedData: unknown = null;

    const returnedRouter: RouterDto = {
      ...mockRouter,
      status: "RETURNED",
    };

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedUrl = config.url ?? "";
      capturedData = JSON.parse(config.data as string);
      return {
        data: { data: returnedRouter },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const dto = {
      status: "RETURNED" as const,
      reason: "Technician returned uninstalled unit",
      targetWarehouseId: "wh-1",
    };

    const result = await transitionRouter("router-1", dto);
    expect(capturedUrl).toBe("/routers/router-1/transition");
    expect(capturedData).toEqual(dto);
    expect(result.status).toBe("RETURNED");
  });

  it("updateRouterCondition patches /routers/:id/condition", async () => {
    let capturedUrl = "";
    let capturedData: unknown = null;

    const damagedRouter: RouterDto = {
      ...mockRouter,
      physicalCondition: "DAMAGED",
    };

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedUrl = config.url ?? "";
      capturedData = JSON.parse(config.data as string);
      return {
        data: { data: damagedRouter },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const dto = {
      physicalCondition: "DAMAGED" as const,
      reason: "Broken antenna during transport",
    };

    const result = await updateRouterCondition("router-1", dto);
    expect(capturedUrl).toBe("/routers/router-1/condition");
    expect(capturedData).toEqual(dto);
    expect(result.physicalCondition).toBe("DAMAGED");
  });

  it("fetches router audit histories (assignments, condition, status)", async () => {
    const mockAssignment: RouterAssignmentDto = {
      id: "asgn-1",
      routerId: "router-1",
      holderType: "TECHNICIAN",
      warehouseId: null,
      technicianId: "tech-1",
      assignedAt: "2026-01-01T00:00:00Z",
      releasedAt: null,
      assignedBy: "admin-1",
      notes: "Field assignment",
    };

    const mockConditionHistory: RouterConditionHistoryDto = {
      id: "ch-1",
      routerId: "router-1",
      fromCondition: "SERVICEABLE",
      toCondition: "DAMAGED",
      fromWarehouseId: "wh-1",
      toWarehouseId: null,
      externalLocation: null,
      reason: "Dropped during delivery",
      changedBy: "admin-1",
      createdAt: "2026-01-01T00:00:00Z",
    };

    const mockStatusHistory: RouterStatusHistoryDto = {
      id: "sh-1",
      routerId: "router-1",
      fromStatus: "AVAILABLE",
      toStatus: "ASSIGNED_TO_TECHNICIAN",
      reason: "Dispatching unit to technician",
      changedBy: "admin-1",
      createdAt: "2026-01-01T00:00:00Z",
    };

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      const url = config.url ?? "";
      if (url.includes("/assignments")) {
        return { data: { data: [mockAssignment] }, status: 200, statusText: "OK", headers: {}, config };
      }
      if (url.includes("/condition-history")) {
        return { data: { data: [mockConditionHistory] }, status: 200, statusText: "OK", headers: {}, config };
      }
      if (url.includes("/status-history")) {
        return { data: { data: [mockStatusHistory] }, status: 200, statusText: "OK", headers: {}, config };
      }
      return { data: {}, status: 404, statusText: "Not Found", headers: {}, config };
    };

    const assignments = await fetchRouterAssignments("router-1");
    expect(assignments).toEqual([mockAssignment]);

    const conditionHistory = await fetchRouterConditionHistory("router-1");
    expect(conditionHistory).toEqual([mockConditionHistory]);

    const statusHistory = await fetchRouterStatusHistory("router-1");
    expect(statusHistory).toEqual([mockStatusHistory]);
  });
});

