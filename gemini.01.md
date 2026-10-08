### System Modules Overview

The system consists of two primary delivery platforms sharing a single backend and database: the **Web Dashboard** and the **Technician Mobile Application**.

---

#### 1. Web Dashboard Modules

- **Authentication & Access Control:** Role-based authentication, session handling with refresh tokens, password reset flows, and isolated permission guards.

- **Admin Dashboard:** Overview snapshots of attendance, active technicians, open tickets, inventory levels, low-stock alerts, router statuses, and key performance indicators.

- **Employee Management:** Employee directory with filtering by department, role, and status; account creation, editing, and soft deactivation.

- **Attendance Management:** Configurable GPS verification (150m radius around assigned warehouse), shift logs, late arrival tracking, and working hour calculations.

- **Warehouse Management:** Multi-warehouse configuration (GPS coordinates, addresses), staff assignments, and stock transfers.

- **Inventory Management:** Product catalog, inbound stock entry, outbound issuance, returns tracking, and low-stock threshold alerts.

- **Router Management:** Lifecycle state tracking (Available, Assigned, Installed, Returned, Damaged, Under Repair, Lost, Decommissioned) and handoff history.

- **IP Address Management:** Centralized IP pool (Available, Assigned, Reserved, Retired), bulk CSV importing, fast indexed search, and automatic ticket assignment linking.

- **Technician Management:** Field engineer profiles, assigned home warehouses, held router tracking, performance metrics, and live status.

- **Live Tracking:** Interactive map (Leaflet.js / OpenStreetMap) displaying real-time GPS locations and online/offline status of checked-in technicians.

- **Customer Management:** Customer directory, service plans, linked router serials and assigned IP addresses, and historical service tickets.

- **Ticket Management:** Ticket workflows (Installation, Technical Issue, Complaint, Maintenance), morning batch assignment engine, manual dispatch overrides, photo verification, and post-closure CS ratings.

- **Reports & Exports:** Background generation and export (Excel/PDF) for attendance, inventory movements, router lifecycles, technician performance, tickets, and customer histories.

- **Settings:** System user accounts, role and permission configuration, shift times, GPS tolerance radius, and alert thresholds.

---

#### 2. Technician Mobile Application (Android-first)

- **Authentication & Profile:** Mobile login, password recovery, secure token storage, and read-only personal details.

- **Home Dashboard:** Daily shift status, daily working hour counter, and real-time task summary.

- **Mobile Attendance:** GPS-enforced check-in and check-out verified within 150m of the assigned warehouse.

- **Live Location Tracking:** Background GPS coordinate streaming to the backend during active shifts.

- **My Tasks (Field Operations):** Filtered task lists, job details (address, description, customer contact, read-only IP/router serial), state transitions (Start / Complete), and mandatory camera photo uploads.

- **Push Notifications:** Firebase Cloud Messaging (FCM) handlers for morning batch schedules and urgent daytime ticket assignments.

---

### Role-Based Permission Matrix

| Module / Capability                       | Admin       | Warehouse Staff   | Customer Service (CS) | Technician          |
| ----------------------------------------- | ----------- | ----------------- | --------------------- | ------------------- |
| **System Settings & User Management**     | Full Access | No Access         | No Access             | No Access           |
| **Admin Executive Dashboard**             | Full Access | No Access         | No Access             | No Access           |
| **Employee Management**                   | Full Access | No Access         | No Access             | No Access           |
| **Attendance (Web Logs & Overviews)**     | Full Access | No Access         | No Access             | No Access           |
| **Warehouse Profiles & Configurations**   | Full Access | View Only         | No Access             | No Access           |
| **Inventory (Inbound, Outbound, Alerts)** | Full Access | Full Access       | No Access             | No Access           |
| **Router Lifecycle & Handoffs**           | Full Access | Full Access       | View Only             | Update via Task     |
| **IP Address Management (Pool & Import)** | Full Access | No Access         | View Only             | View Only via task  |
| **Technician Management & Performance**   | Full Access | No Access         | No Access             | view only his stats | view by id for ex                                      |
| **Live Tracking Map (Web)**               | Full Access | No Access         | View Only             | Transmit GPS        | send his location to the system by the geolocaion apis |
| **Customer Profiles**                     | Full Access | No Access         | Full Access           | Read-Only on Task   |
| **Ticket Dispatch & Morning Batch**       | Full Access | No Access         | Full Access           | No Access           |
| **Customer Satisfaction Ratings**         | Full Access | No Access         | Create / Log          | No Access           |
| **System Reports (Excel & PDF)**          | Full Access | Inventory Reports | Ticket Reports        | No Access           |
| **Mobile App (Attendance, Tasks, GPS)**   | Full Access | No Access         | No Access             | Full Access         |

---

Would you like to detail the database schema models and foreign key relations supporting this exact permission structure?
