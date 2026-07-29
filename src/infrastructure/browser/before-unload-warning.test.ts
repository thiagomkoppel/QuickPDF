import { describe, expect, it, vi } from "vitest";

import { BrowserBeforeUnloadWarning } from "./before-unload-warning";

describe("BrowserBeforeUnloadWarning", () => {
  it("prevents unload only while dirty warning is enabled and removes the listener on disposal", () => {
    const warning = new BrowserBeforeUnloadWarning();
    const event = new Event("beforeunload", { cancelable: true });
    const preventDefault = vi.spyOn(event, "preventDefault");

    window.dispatchEvent(event);
    expect(preventDefault).not.toHaveBeenCalled();

    warning.setEnabled(true);
    window.dispatchEvent(event);
    expect(preventDefault).toHaveBeenCalledOnce();

    warning.dispose();
    window.dispatchEvent(event);
    expect(preventDefault).toHaveBeenCalledOnce();
  });
});
