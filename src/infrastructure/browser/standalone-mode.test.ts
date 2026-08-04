import { describe, expect, it } from "vitest";

import { detectStandaloneMode, isIosSafari } from "./standalone-mode";

describe("standalone mode", () => {
  it("recognizes display-mode standalone and iOS navigator standalone", () => {
    expect(detectStandaloneMode({ displayModeMatches: true, navigatorStandalone: false })).toBe(
      true,
    );
    expect(detectStandaloneMode({ displayModeMatches: false, navigatorStandalone: true })).toBe(
      true,
    );
    expect(detectStandaloneMode({ displayModeMatches: false, navigatorStandalone: false })).toBe(
      false,
    );
  });

  it("recognizes iPadOS Safari desktop user agents when touch capability is present", () => {
    expect(
      isIosSafari({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
        standalone: false,
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });
  it("shows iOS install guidance only for Safari outside standalone mode", () => {
    expect(
      isIosSafari({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
        standalone: false,
        maxTouchPoints: 0,
      }),
    ).toBe(true);
    expect(
      isIosSafari({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120.0 Mobile/15E148 Safari/604.1",
        standalone: false,
        maxTouchPoints: 0,
      }),
    ).toBe(false);
    expect(
      isIosSafari({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
        standalone: true,
        maxTouchPoints: 0,
      }),
    ).toBe(false);
  });
});
