import { describe, it, expect } from "vitest";
import { normalizePaginatedResponse } from "../pagination";

describe("normalizePaginatedResponse", () => {
  interface SampleItem {
    id: string;
    name: string;
  }

  const sampleItems: SampleItem[] = [
    { id: "1", name: "Alpha" },
    { id: "2", name: "Beta" },
    { id: "3", name: "Gamma" },
  ];

  it("normalizes HR format { data, meta } correctly", () => {
    const raw = {
      data: sampleItems,
      meta: {
        page: 2,
        pageSize: 10,
        total: 25,
        totalPages: 3,
      },
    };

    const result = normalizePaginatedResponse<SampleItem>(raw);

    expect(result.items).toEqual(sampleItems);
    expect(result.total).toBe(25);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    expect(result.totalPages).toBe(3);
  });

  it("calculates totalPages for HR format if totalPages is omitted in meta", () => {
    const raw = {
      data: sampleItems,
      meta: {
        page: 1,
        pageSize: 2,
        total: 5,
      },
    };

    const result = normalizePaginatedResponse<SampleItem>(raw);

    expect(result.items).toEqual(sampleItems);
    expect(result.total).toBe(5);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(2);
    expect(result.totalPages).toBe(3); // ceil(5 / 2)
  });

  it("normalizes Supply format { items, total } correctly", () => {
    const raw = {
      items: sampleItems,
      total: 30,
    };

    const result = normalizePaginatedResponse<SampleItem>(raw, 3, 10);

    expect(result.items).toEqual(sampleItems);
    expect(result.total).toBe(30);
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(10);
    expect(result.totalPages).toBe(3); // ceil(30 / 10)
  });

  it("normalizes raw array payload", () => {
    const raw = sampleItems;

    const result = normalizePaginatedResponse<SampleItem>(raw, 1, 20);

    expect(result.items).toEqual(sampleItems);
    expect(result.total).toBe(3);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.totalPages).toBe(1);
  });

  it("handles outer interceptor response wrapper { data: { items, total } }", () => {
    const raw = {
      data: {
        items: sampleItems,
        total: 15,
      },
    };

    const result = normalizePaginatedResponse<SampleItem>(raw, 1, 5);

    expect(result.items).toEqual(sampleItems);
    expect(result.total).toBe(15);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(5);
    expect(result.totalPages).toBe(3);
  });

  it("returns safe defaults for null or non-object payloads", () => {
    const fromNull = normalizePaginatedResponse<SampleItem>(null);
    expect(fromNull).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });

    const fromUndefined = normalizePaginatedResponse<SampleItem>(undefined);
    expect(fromUndefined).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });

    const fromPrimitive = normalizePaginatedResponse<SampleItem>("string");
    expect(fromPrimitive).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });
  });

  it("returns safe defaults for unexpected empty object", () => {
    const result = normalizePaginatedResponse<SampleItem>({});
    expect(result).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });
  });
});

