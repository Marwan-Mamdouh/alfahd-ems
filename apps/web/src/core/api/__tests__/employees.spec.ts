import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { api } from "../axios-instance";
import {
  fetchEmployeeLookup,
  fetchEmployeeById,
  createEmployee,
  updateEmployee,
  updateEmployeeStatus,
} from "../employees";
import type { EmployeeLookupDto, EmployeeDto } from "../types";
import { Role } from "@alfahd/types";

describe("Employees API Client Functions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchEmployeeLookup", () => {
    it("calls /employees/lookup with query params and unwraps the response", async () => {
      const mockLookups: EmployeeLookupDto[] = [
        {
          id: "tech-1",
          name: "Mahmoud Ahmed",
          role: Role.TECHNICIAN,
          status: "ACTIVE",
          isEligible: true,
          assignedWarehouseId: "warehouse-1",
        },
      ];

      let capturedUrl = "";
      let capturedParams: Record<string, unknown> = {};

      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        capturedUrl = config.url ?? "";
        capturedParams = (config.params as Record<string, unknown>) ?? {};
        return {
          data: { data: mockLookups },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };

      const result = await fetchEmployeeLookup({
        role: Role.TECHNICIAN,
        warehouse_id: "warehouse-1",
        limit: 10,
      });

      expect(capturedUrl).toBe("/employees/lookup");
      expect(capturedParams).toEqual({
        role: Role.TECHNICIAN,
        warehouse_id: "warehouse-1",
        limit: 10,
      });
      expect(result).toEqual(mockLookups);
    });
  });

  describe("fetchEmployeeById", () => {
    it("calls /employees/:id and returns EmployeeDto", async () => {
      const mockEmployee: EmployeeDto = {
        id: "emp-1",
        name: "Omar Ali",
        email: "omar@alfahd.local",
        role: Role.TECHNICIAN,
        department: "TECHNICAL",
        status: "ACTIVE",
        createdAt: "2026-01-01T00:00:00Z",
      };

      let capturedUrl = "";
      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        capturedUrl = config.url ?? "";
        return {
          data: { data: mockEmployee },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };

      const result = await fetchEmployeeById("emp-1");
      expect(capturedUrl).toBe("/employees/emp-1");
      expect(result).toEqual(mockEmployee);
    });
  });

  describe("createEmployee and updateEmployee", () => {
    it("posts payload to /employees", async () => {
      let capturedMethod = "";
      let capturedUrl = "";
      let capturedData: unknown = null;

      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        capturedMethod = config.method ?? "";
        capturedUrl = config.url ?? "";
        capturedData = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
        return {
          data: { data: { id: "new-emp" } },
          status: 201,
          statusText: "Created",
          headers: {},
          config,
        };
      };

      await createEmployee({
        name: "New Guy",
        email: "new@alfahd.local",
        role: Role.TECHNICIAN,
      });

      expect(capturedMethod.toLowerCase()).toBe("post");
      expect(capturedUrl).toBe("/employees");
      expect(capturedData).toEqual({
        name: "New Guy",
        email: "new@alfahd.local",
        role: Role.TECHNICIAN,
      });
    });

    it("patches /employees/:id with updates", async () => {
      let capturedMethod = "";
      let capturedUrl = "";

      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        capturedMethod = config.method ?? "";
        capturedUrl = config.url ?? "";
        return {
          data: { data: { id: "emp-1", name: "Updated Name" } },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };

      await updateEmployee("emp-1", { name: "Updated Name" });
      expect(capturedMethod.toLowerCase()).toBe("patch");
      expect(capturedUrl).toBe("/employees/emp-1");
    });

    it("patches /employees/:id/status with mandatory reason", async () => {
      let capturedUrl = "";
      let capturedData: unknown = null;

      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        capturedUrl = config.url ?? "";
        capturedData = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
        return {
          data: { data: { id: "emp-1", status: "INACTIVE" } },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };

      await updateEmployeeStatus("emp-1", {
        status: "INACTIVE",
        reason: "Contract ended",
      });

      expect(capturedUrl).toBe("/employees/emp-1/status");
      expect(capturedData).toEqual({
        status: "INACTIVE",
        reason: "Contract ended",
      });
    });
  });
});

