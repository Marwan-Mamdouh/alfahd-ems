# Alfahd EMS domain language

## Supply chain

**Product/SKU**:
A catalog definition shared by equivalent items; it is not an individual physical router.
_Avoid_: Router asset when referring to the catalog definition.

**Router asset**:
One physical router identified by its unique serial number and linked to a product/SKU.
_Avoid_: Stock quantity as a synonym for a device.

**Lifecycle status**:
A router's position in the assignment, installation and return lifecycle; it is distinct from the device's physical condition.
_Avoid_: Condition as a synonym for lifecycle.

**Physical condition**:
The router's serviceability, damage or repair condition, independently of its lifecycle status.
_Avoid_: AVAILABLE as a guarantee of serviceability.

**Custody**:
The current responsible warehouse, technician or customer, if any; empty custody does not mean the physical location is unknown.
_Avoid_: Physical location as a synonym for custody.

**Physical location**:
Where a router is physically recorded, including a warehouse or an external repair location for damaged/repair devices.
_Avoid_: Current holder as a synonym for physical location.

**Usable router stock**:
Routers that are AVAILABLE in lifecycle, serviceable in condition and physically in a warehouse.
_Avoid_: All warehouse routers when referring to usable quantity.

**Existing-stock registration**:
Identifying by serial a physical unit already included in opening stock, rather than receiving another unit.
_Avoid_: New receipt for a unit already counted.

## IP management

**FREE IP**:
An individual IPv4 address that is not reserved; archived records are not available for allocation.
_Avoid_: AVAILABLE as the IP status name.

**RESERVED IP**:
An individual IPv4 address already in use or allocated and unavailable to another allocation.
_Avoid_: Pending approval as the meaning of RESERVED.

**IP allocation**:
Automatic selection and reservation of a free address for an eligible installation ticket, without a human approval queue.
_Avoid_: Approval request for this automatic operation.
