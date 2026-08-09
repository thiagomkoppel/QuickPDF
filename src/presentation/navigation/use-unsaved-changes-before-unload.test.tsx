import { act, render } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { useUnsavedChangesBeforeUnload } from "./use-unsaved-changes-before-unload";

const BeforeUnloadHarness = (): React.ReactElement => {
  const [isDirty, setIsDirty] = useState(false);
  useUnsavedChangesBeforeUnload(isDirty);

  return (
    <button
      type="button"
      onClick={() => {
        setIsDirty((value) => !value);
      }}
    >
      Toggle dirty
    </button>
  );
};

describe("useUnsavedChangesBeforeUnload", () => {
  it("registers the native warning only while the editor session is dirty", () => {
    const { getByRole } = render(<BeforeUnloadHarness />);
    const dispatch = (): Event => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event;
    };

    expect(dispatch().defaultPrevented).toBe(false);

    act(() => {
      getByRole("button", { name: "Toggle dirty" }).click();
    });
    expect(dispatch().defaultPrevented).toBe(true);

    act(() => {
      getByRole("button", { name: "Toggle dirty" }).click();
    });
    expect(dispatch().defaultPrevented).toBe(false);
  });
});
