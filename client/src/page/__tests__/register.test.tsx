import "../../test/setup";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("i18next", () => ({
  t: (key: string, opts?: any) => {
    if (opts && opts.name) return `suggested:${opts.name}`;
    const map: Record<string, string> = {
      "register.title": "Create Account",
      "register.invalid_token": "invalid_token",
      "register.username.placeholder": "username",
      "register.username.required": "username_required",
      "register.checking": "checking",
      "register.available": "available",
      "register.username_taken": "username_taken",
      "register.submit": "submit",
      "register.submitting": "submitting",
      "register.failed": "failed",
    };
    return map[key] ?? key;
  },
}));

const setLocationMock = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/register", setLocationMock],
}));

vi.mock("../../utils/auth", () => ({
  setAuthToken: vi.fn(),
}));

const checkUsernameMock = vi.fn();
const registerMock = vi.fn();
vi.mock("../../app/runtime", () => ({
  client: {
    user: {
      checkUsername: (...args: any[]) => checkUsernameMock(...args),
      register: (...args: any[]) => registerMock(...args),
    },
  },
}));

import { RegisterPage } from "../register";

function setSearch(search: string) {
  window.location.search = search;
}

function makeToken(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `header.${encoded}.signature`;
}

beforeEach(() => {
  vi.clearAllMocks();
  setLocationMock.mockClear();
  checkUsernameMock.mockReset();
  registerMock.mockReset();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      search: "",
      reload: vi.fn(),
      href: "",
    },
  });
  setSearch("");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RegisterPage", () => {
  it("shows an error when the registration token is missing", () => {
    setSearch("");
    render(<RegisterPage />);
    expect(screen.getByText("invalid_token")).toBeInTheDocument();
  });

  it("shows avatar and suggested username decoded from the token", () => {
    setSearch("?token=" + makeToken({ avatar: "https://a.png", suggestedUsername: "alice" }));
    render(<RegisterPage />);
    const img = document.querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("https://a.png");
    expect(screen.getByText("suggested:alice")).toBeInTheDocument();
    expect((screen.getByPlaceholderText("username") as HTMLInputElement).value).toBe("alice");
  });

  it("reflects an unavailable username from the availability check", async () => {
    setSearch("?token=" + makeToken({ suggestedUsername: "alice" }));
    checkUsernameMock.mockResolvedValue({ data: { available: false } });
    render(<RegisterPage />);
    await waitFor(() => expect(screen.getByText("username_taken")).toBeInTheDocument(), { timeout: 2000 });
  });

  it("reflects an available username from the availability check", async () => {
    setSearch("?token=" + makeToken({ suggestedUsername: "alice" }));
    checkUsernameMock.mockResolvedValue({ data: { available: true } });
    render(<RegisterPage />);
    await waitFor(() => expect(screen.getByText("available")).toBeInTheDocument(), { timeout: 2000 });
  });

  it("registers the user and stores the token on submit", async () => {
    setSearch("?token=" + makeToken({ suggestedUsername: "alice" }));
    checkUsernameMock.mockResolvedValue({ data: { available: true } });
    registerMock.mockResolvedValue({ data: { token: "new_token" }, error: undefined });

    render(<RegisterPage />);
    await waitFor(() => expect(screen.getByText("available")).toBeInTheDocument(), { timeout: 2000 });

    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() => expect(registerMock).toHaveBeenCalledTimes(1));
    expect(registerMock).toHaveBeenCalledWith({ token: expect.any(String), username: "alice" });
    const { setAuthToken } = await import("../../utils/auth");
    expect(setAuthToken).toHaveBeenCalledWith("new_token");
    expect(setLocationMock).toHaveBeenCalledWith("/");
  });

  it("blocks submit when the username is taken", async () => {
    setSearch("?token=" + makeToken({ suggestedUsername: "alice" }));
    checkUsernameMock.mockResolvedValue({ data: { available: false } });
    registerMock.mockResolvedValue({ data: { token: "new_token" }, error: undefined });

    render(<RegisterPage />);
    await waitFor(() => expect(screen.getByText("username_taken")).toBeInTheDocument(), { timeout: 2000 });

    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    await new Promise((r) => setTimeout(r, 100));
    expect(registerMock).not.toHaveBeenCalled();
    expect(screen.getAllByText("username_taken").length).toBeGreaterThan(0);
  });
});
