/**
 * API-facing warehouse shape. The persistence layer stores coordinates as
 * `gps_lat` / `gps_lng` (shared with attendance); `WarehousesRepository` maps
 * rows to this contract.
 */
export interface Warehouse {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  geofenceRadiusMeters: number;
  managerId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Writable fields accepted by `WarehousesRepository.create`. */
export type CreateWarehouseInput = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  geofenceRadiusMeters?: number;
  managerId?: string | null;
};

/** Writable fields accepted by `WarehousesRepository.updateWarehouse`. */
export type UpdateWarehouseInput = Partial<CreateWarehouseInput>;
