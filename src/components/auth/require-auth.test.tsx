import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { RequireAuth } from "./require-auth";
import { useAuth } from "../../auth/use-auth";

vi.mock("../../auth/use-auth", () => ({
  useAuth: vi.fn(),
}));

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/"
          element={
            <RequireAuth>
              <div>Protected content</div>
            </RequireAuth>
          }
        />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>
  );

describe("RequireAuth", () => {
  it("renders nothing while auth is still loading", () => {
    mockUseAuth.mockReturnValue({ me: null, loading: true });
    const { container } = renderAt("/");
    expect(container).toBeEmptyDOMElement();
  });

  it("redirects to /login when there is no logged in user", () => {
    mockUseAuth.mockReturnValue({ me: null, loading: false });
    renderAt("/");
    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  it("renders the protected content when logged in", () => {
    mockUseAuth.mockReturnValue({
      me: { user: { id: "1", username: "alice", displayName: "Alice" } },
      loading: false,
    });
    renderAt("/");
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });
});
