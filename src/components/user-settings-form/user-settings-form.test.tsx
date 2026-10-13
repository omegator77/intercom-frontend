import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserSettingsForm } from "./user-settings-form";

const submit = vi.fn();
let mockState: Record<string, unknown> = {};

vi.mock("../../global-state/context-provider", () => ({
  useGlobalState: () => [mockState, vi.fn()],
}));
vi.mock("../../auth/use-auth", () => ({
  useAuth: () => ({ me: { user: { id: "u1", username: "bob" } } }),
}));
vi.mock("../landing-page/use-fetch-production-list", () => {
  const result = {
    productions: {
      productions: [
        {
          name: "Show A",
          productionId: "4",
          lines: [
            { id: "1", name: "Regie", participants: [] },
            { id: "2", name: "Technik", participants: [] },
          ],
        },
        {
          name: "Show B",
          productionId: "5",
          lines: [
            { id: "51", name: "Licht", participants: [] },
            { id: "52", name: "Ton", participants: [] },
          ],
        },
      ],
    },
    error: null,
  };
  return { useFetchProductionList: () => result };
});
vi.mock("./use-submit-form", () => ({
  useSubmitForm: () => ({ onSubmit: (v: unknown) => submit(v) }),
}));
vi.mock("../../hooks/use-submit-form-enter-press", () => ({
  useSubmitOnEnter: () => undefined,
}));
vi.mock("../reload-devices-button.tsx/reload-devices-button", () => ({
  ReloadDevicesButton: () => null,
}));

const defaultValues = {
  productionId: "",
  lineId: "",
  username: "bob",
  audioinput: "in1",
  audiooutput: "out1",
  lineUsedForProgramOutput: false,
  isProgramUser: false,
};

const joinedCall = (productionId: string, lineId: string) => ({
  joinProductionOptions: { productionId, lineId },
});

const form = () => (
  <UserSettingsForm
    isJoinProduction
    buttonText="Join"
    defaultValues={defaultValues}
  />
);

describe("Add-call form with a call already running in production 4", () => {
  beforeEach(() => {
    submit.mockReset();
    mockState = {
      devices: {
        input: [{ deviceId: "in1", label: "Mic" }],
        output: [{ deviceId: "out1", label: "Speaker" }],
      },
      selectedProductionId: "4",
      calls: { c1: joinedCall("4", "1") },
    };
  });

  it("joins the line of the OTHER production that was picked, not the running one", async () => {
    const user = userEvent.setup();
    const { container, rerender } = render(form());
    const [productionSelect] = container.querySelectorAll("select");

    await user.selectOptions(productionSelect, "5");
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Ton" })).toBeInTheDocument()
    );

    await user.selectOptions(container.querySelectorAll("select")[1], "52");

    // Every call update (audio level, connection state, ...) gives `calls` a new identity.
    for (let i = 0; i < 3; i += 1) {
      mockState = { ...mockState, calls: { c1: joinedCall("4", "1") } };
      act(() => rerender(form()));
    }

    expect(
      (container.querySelectorAll("select")[0] as HTMLSelectElement).value
    ).toBe("5");
    expect(
      (container.querySelectorAll("select")[1] as HTMLSelectElement).value
    ).toBe("52");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Join" })).toBeEnabled()
    );
    await user.click(screen.getByRole("button", { name: "Join" }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0]).toMatchObject({
      productionId: "5",
      lineId: "52",
    });
  });

  it("does not offer lines already joined in the chosen production", async () => {
    const user = userEvent.setup();
    const { container } = render(form());
    await user.selectOptions(container.querySelectorAll("select")[0], "4");
    await waitFor(() =>
      expect(
        screen.getByRole("option", { name: "Technik" })
      ).toBeInTheDocument()
    );
    expect(
      screen.queryByRole("option", { name: "Regie" })
    ).not.toBeInTheDocument();
  });
});
