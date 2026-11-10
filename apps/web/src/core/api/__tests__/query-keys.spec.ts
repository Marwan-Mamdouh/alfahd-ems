import { describe, it, expect } from "vitest";
import { queryKeys } from "@/core/query/query-keys";

describe("queryKeys factories", () => {
  it("generates predictable hierarchical keys for employees", () => {
    expect(queryKeys.employees.all).toEqual(["employees"]);
    expect(queryKeys.employees.lists()).toEqual(["employees", "list"]);
    expect(queryKeys.employees.list({ page: 1, pageSize: 20 })).toEqual([
      "employees",
      "list",
      { page: 1, pageSize: 20 },
    ]);
    expect(queryKeys.employees.details()).toEqual(["employees", "detail"]);
    expect(queryKeys.employees.detail("emp-123")).toEqual(["employees", "detail", "emp-123"]);
  });

  it("generates predictable keys for warehouses and sub-resources", () => {
    expect(queryKeys.warehouses.all).toEqual(["warehouses"]);
    expect(queryKeys.warehouses.lists()).toEqual(["warehouses", "list"]);
    expect(queryKeys.warehouses.detail("wh-1")).toEqual(["warehouses", "detail", "wh-1"]);
    expect(queryKeys.warehouses.stock("wh-1")).toEqual([
      "warehouses",
      "detail",
      "wh-1",
      "stock",
    ]);
  });

  it("generates predictable keys for inventory operations", () => {
    expect(queryKeys.inventory.all).toEqual(["inventory"]);
    expect(queryKeys.inventory.balances({ warehouseId: "wh-1" })).toEqual([
      "inventory",
      "balances",
      { warehouseId: "wh-1" },
    ]);
    expect(queryKeys.inventory.warehouseStock("wh-1")).toEqual([
      "inventory",
      "warehouse-stock",
      "wh-1",
    ]);
    expect(queryKeys.inventory.movements({ productId: "p-1" })).toEqual([
      "inventory",
      "movements",
      { productId: "p-1" },
    ]);
  });

  it("generates predictable keys for routers and triple audit histories", () => {
    expect(queryKeys.routers.all).toEqual(["routers"]);
    expect(queryKeys.routers.detail("r-1")).toEqual(["routers", "detail", "r-1"]);
    expect(queryKeys.routers.assignmentHistory("r-1")).toEqual([
      "routers",
      "detail",
      "r-1",
      "assignments",
    ]);
    expect(queryKeys.routers.conditionHistory("r-1")).toEqual([
      "routers",
      "detail",
      "r-1",
      "condition-history",
    ]);
    expect(queryKeys.routers.statusHistory("r-1")).toEqual([
      "routers",
      "detail",
      "r-1",
      "status-history",
    ]);
  });

  it("generates predictable keys for ip-addresses and jobs", () => {
    expect(queryKeys.ipAddresses.all).toEqual(["ipAddresses"]);
    expect(queryKeys.ipAddresses.detail("ip-1")).toEqual(["ipAddresses", "detail", "ip-1"]);
    expect(queryKeys.ipAddresses.history("ip-1")).toEqual([
      "ipAddresses",
      "detail",
      "ip-1",
      "history",
    ]);
    expect(queryKeys.jobs.all).toEqual(["jobs"]);
    expect(queryKeys.jobs.status("job-1")).toEqual(["jobs", "status", "job-1"]);
  });
});

