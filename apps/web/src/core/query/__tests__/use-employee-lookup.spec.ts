import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { QueryClient } from "@tanstack/react-query";
import { api } from "@/core/api/axios-instance";
import { queryKeys } from "../query-keys";
import { fetchEmployeeLookup } from "@/core/api/employees";
import { Role } from "@alfahd/types";
import type { EmployeeLookupDto } from "@/core/api/types";

describe("Employee Lookup Query Lifecycle", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  it("fetches employee lookup and caches by query key", async () => {
    const mockTechs: EmployeeLookupDto[] = [
      {
        id: "tech-1",
        name: "Youssef Mohamed",
        role: Role.TECHNICIAN,
        status: "ACTIVE",
        isEligible: true,
        assignedWarehouseId: "warehouse-cairo",
      },
    ];

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      return {
        data: { data: mockTechs },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const params = { role: Role.TECHNICIAN, status: "ACTIVE" as const };
    const key = queryKeys.employees.lookup(params);

    const result = await queryClient.fetchQuery({
      queryKey: key,
      queryFn: () => fetchEmployeeLookup(params),
    });

    expect(result).toEqual(mockTechs);
    expect(queryClient.getQueryData(key)).toEqual(mockTechs);
  });

  it("invalidates lookup cache when employees.all is invalidated", async () => {
    const mockTechs: EmployeeLookupDto[] = [
      {
        id: "tech-1",
        name: "Youssef Mohamed",
        role: Role.TECHNICIAN,
        status: "ACTIVE",
        isEligible: true,
      },
    ];

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      return {
        data: { data: mockTechs },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const key = queryKeys.employees.lookup({ role: Role.TECHNICIAN });
    await queryClient.fetchQuery({
      queryKey: key,
      queryFn: () => fetchEmployeeLookup({ role: Role.TECHNICIAN }),
    });

    expect(queryClient.getQueryState(key)?.status).toBe("success");

    // Invalidate broad employees scope
    await queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });

    const query = queryClient.getQueryCache().find({ queryKey: key });
    expect(query?.isStale()).toBe(true);
  });
});
