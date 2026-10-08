# API Contracts: M1 Foundation

These contracts define the shared types and API endpoints required for M1. These types should be implemented in `@alfahd/types` and consumed by the API.

## Enums
```typescript
export enum Role {
  ADMIN = 'ADMIN',
  WAREHOUSE_STAFF = 'WAREHOUSE_STAFF',
  CS = 'CS',
  TECHNICIAN = 'TECHNICIAN'
}
```

## DTOs (Data Transfer Objects)

### Authentication
```typescript
export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface LoginResponseDto {
  accessToken: string;
  // Refresh token is handled via HTTP-Only cookie for web, or explicitly returned for mobile
  refreshToken?: string;
  user: UserDto;
}

export interface RefreshTokenRequestDto {
  refreshToken: string; // Used by mobile apps, web uses cookies
}

export interface RefreshTokenResponseDto {
  accessToken: string;
}

export interface ForgotPasswordRequestDto {
  email: string;
}

export interface ResetPasswordRequestDto {
  token: string;
  newPassword: string;
}

export interface ChangePasswordRequestDto {
  oldPassword: string;
  newPassword: string;
}
```

### Users
```typescript
export interface UserDto {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface CreateUserDto {
  email: string;
  password: string; // Initially set by admin
  role: Role;
}

export interface UpdateUserDto {
  email?: string;
  role?: Role;
  isActive?: boolean; // Used for soft-deactivation
}
```

## Endpoints

### Auth
- `POST /auth/login` (Rate limited: 5 per 10m)
- `POST /auth/logout` (Requires JWT)
- `POST /auth/refresh` 
- `POST /auth/forgot-password`
- `POST /auth/reset-password`

### Users
- `POST /users` (Role: ADMIN)
- `GET /users` (Role: ADMIN)
- `GET /users/:id` (Role: ADMIN)
- `PATCH /users/:id` (Role: ADMIN)
- `POST /users/:id/revoke-session` (Role: ADMIN)
- `POST /users/change-password` (Role: ANY AUTHENTICATED USER)
