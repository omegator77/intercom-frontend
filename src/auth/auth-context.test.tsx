import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { AuthProvider } from "./auth-context.tsx";
import { useAuth } from "./use-auth.ts";
import { API, TMeResponse } from "../api/api.ts";

vi.mock("../api/api.ts", () => ({
  API: {
    me: vi.fn(),
    logout: vi.fn(),
  },
}));

const mockMe = API.me as ReturnType<typeof vi.fn>;
const mockLogout = API.logout as ReturnType<typeof vi.fn>;

const meResponse = (
  overrides: Partial<TMeResponse["user"]> = {}
): TMeResponse => ({
  user: {
    id: "user-1",
    username: "alice",
    displayName: "Alice",
    ...overrides,
  },
  memberships: [{ productionId: 1, role: "producer" }],
});

describe("useAuth", () => {
  beforeEach(() => {
    mockMe.mockReset();
    mockLogout.mockReset();
  });

  it("starts in a loading state and resolves to a guest when /auth/me fails", async () => {
    mockMe.mockRejectedValueOnce(new Error("Unauthorized"));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.me).toBeNull();
    expect(result.current.isSuperAdmin).toBe(false);
  });

  it("exposes the logged in user and their memberships", async () => {
    mockMe.mockResolvedValueOnce(meResponse());
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.me?.user.username).toBe("alice");
    expect(result.current.roleForProduction(1)).toBe("producer");
    expect(result.current.roleForProduction(2)).toBeNull();
  });

  it("grants any role check to a super admin regardless of membership", async () => {
    mockMe.mockResolvedValueOnce({
      user: {
        id: "admin-1",
        username: "admin",
        displayName: "Admin",
        isSuperAdmin: true,
      },
      memberships: [],
    });
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isSuperAdmin).toBe(true);
    expect(result.current.hasProductionRole(42, ["admin"])).toBe(true);
  });

  it("denies a role check when the membership role doesn't match", async () => {
    mockMe.mockResolvedValueOnce(meResponse());
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasProductionRole(1, ["admin"])).toBe(false);
    expect(result.current.hasProductionRole(1, ["producer"])).toBe(true);
  });

  it("clears the user on logout", async () => {
    mockMe.mockResolvedValueOnce(meResponse());
    mockLogout.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.me).not.toBeNull();

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.me).toBeNull();
  });
});
