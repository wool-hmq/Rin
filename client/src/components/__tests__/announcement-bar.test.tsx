import "../../test/setup";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AnnouncementBar } from "../announcement-bar";
import { ClientConfigContext, ConfigWrapper } from "../../state/config";

function renderWithConfig(config: Record<string, unknown>) {
  const wrapper = new ConfigWrapper(config, new Map());
  return render(
    <ClientConfigContext.Provider value={wrapper}>
      <AnnouncementBar />
    </ClientConfigContext.Provider>,
  );
}

describe("AnnouncementBar", () => {
  afterEach(() => {
    cleanup();
  });

  it("should render nothing when announcement content is empty", () => {
    const { container } = renderWithConfig({ "announcement.content": "" });
    expect(container.querySelector(".announcement-bar")).toBeNull();
  });

  it("should render nothing when announcement content is missing", () => {
    const { container } = renderWithConfig({});
    expect(container.querySelector(".announcement-bar")).toBeNull();
  });

  it("should render scrolling announcement with black background and red text", () => {
    const { container } = renderWithConfig({ "announcement.content": "欢迎来到本站" });
    const bar = container.querySelector(".announcement-bar");
    expect(bar).not.toBeNull();
    expect(bar!.className).toContain("bg-black");
    const spans = bar!.querySelectorAll("span");
    expect(spans.length).toBe(2);
    spans.forEach((span) => {
      expect(span.className).toContain("text-red-500");
    });
    expect(spans[0]?.textContent).toBe("欢迎来到本站");
  });

  it("should ignore surrounding whitespace when deciding to render", () => {
    const { container } = renderWithConfig({ "announcement.content": "   " });
    expect(container.querySelector(".announcement-bar")).toBeNull();
  });

  it("should apply configured scroll speed as animation duration", () => {
    const { container } = renderWithConfig({ "announcement.content": "欢迎", "announcement.speed": 10 });
    const track = container.querySelector(".announcement-track") as HTMLElement;
    expect(track.style.animationDuration).toBe("10s");
  });

  it("should fall back to default duration when speed is invalid", () => {
    const { container } = renderWithConfig({ "announcement.content": "欢迎", "announcement.speed": "abc" });
    const track = container.querySelector(".announcement-track") as HTMLElement;
    expect(track.style.animationDuration).toBe("22s");
  });

  it("should fall back to default duration when speed is missing", () => {
    const { container } = renderWithConfig({ "announcement.content": "欢迎" });
    const track = container.querySelector(".announcement-track") as HTMLElement;
    expect(track.style.animationDuration).toBe("22s");
  });
});
