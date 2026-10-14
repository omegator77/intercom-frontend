import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { ManageUsersPage } from "./manage-users-page";

const api = vi.hoisted(() => ({
  getUsers: vi.fn(),
  setUserSuperAdmin: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock("../../api/api", () => ({ API: api }));
vi.mock("../../auth/use-auth", () => ({
  useAuth: () => ({
    isSuperAdmin: true,
    loading: false,
    me: { user: { id: "root", username: "root", isSuperAdmin: true } },
  }),
}));
vi.mock("../page-layout/page-header", () => ({
  PageHeader: () => null,
}));

const user = (over: Record<string, unknown>) => ({
  displayName: "X",
  createdAt: "2024-01-01T00:00:00.000Z",
  membershipCount: 1,
  ...over,
});

const users = [
  user({ userId: "root", username: "root", isSuperAdmin: true }),
  user({ userId: "u1", username: "alice" }),
  user({ userId: "u2", username: "bob", isSuperAdmin: true }),
];

const rowOf = (name: string) =>
  screen.getByText(new RegExp(`[(]${name}[)]`)).parentElement as HTMLElement;

const renderPage = () =>
  render(
    <MemoryRouter>
      <ManageUsersPage />
    </MemoryRouter>
  );

describe("ManageUsersPage super admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getUsers.mockResolvedValue({ users });
    api.setUserSuperAdmin.mockResolvedValue({});
  });

  it("marks super admins and offers the matching action per account", async () => {
    renderPage();
    await screen.findByText(/\(alice\)/);

    expect(within(rowOf("root")).getByText("Super admin")).toBeTruthy();
    expect(within(rowOf("alice")).queryByText("Super admin")).toBeNull();
    expect(
      within(rowOf("alice")).getByRole("button", { name: "Make super admin" })
    ).toBeTruthy();
    expect(
      within(rowOf("bob")).getByRole("button", { name: "Remove super admin" })
    ).toBeTruthy();
  });

  it("offers no role change for your own account", async () => {
    renderPage();
    await screen.findByText(/\(root\)/);
    expect(
      within(rowOf("root")).queryByRole("button", { name: /super admin/ })
    ).toBeNull();
  });

  it("asks for confirmation before granting, then reloads", async () => {
    const click = userEvent.setup();
    renderPage();
    await screen.findByText(/\(alice\)/);

    await click.click(
      within(rowOf("alice")).getByRole("button", { name: "Make super admin" })
    );
    expect(api.setUserSuperAdmin).not.toHaveBeenCalled();

    await click.click(screen.getByRole("button", { name: /confirm|yes|ok/i }));
    await waitFor(() =>
      expect(api.setUserSuperAdmin).toHaveBeenCalledWith("u1", true)
    );
    await waitFor(() => expect(api.getUsers).toHaveBeenCalledTimes(2));
  });

  it("revokes with false and shows the server's refusal", async () => {
    api.setUserSuperAdmin.mockRejectedValueOnce(
      new Error("The last super admin cannot be removed")
    );
    const click = userEvent.setup();
    renderPage();
    await screen.findByText(/\(bob\)/);

    await click.click(
      within(rowOf("bob")).getByRole("button", { name: "Remove super admin" })
    );
    await click.click(screen.getByRole("button", { name: /confirm|yes|ok/i }));

    await waitFor(() =>
      expect(api.setUserSuperAdmin).toHaveBeenCalledWith("u2", false)
    );
    expect(
      await screen.findByText("The last super admin cannot be removed")
    ).toBeTruthy();
  });
});
