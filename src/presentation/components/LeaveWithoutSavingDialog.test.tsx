import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LeaveWithoutSavingDialog } from "./LeaveWithoutSavingDialog";

describe("LeaveWithoutSavingDialog", () => {
  it("keeps the editor safe by default and traps keyboard focus", async () => {
    const user = userEvent.setup();
    const onStay = vi.fn();
    const onLeave = vi.fn();
    render(<LeaveWithoutSavingDialog onLeave={onLeave} onStay={onStay} />);

    expect(screen.getByRole("dialog", { name: "Leave without saving?" })).toBeInTheDocument();
    expect(screen.getByText(/You have unsaved changes in this PDF\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stay here" })).toHaveFocus();

    await user.keyboard("{Tab}");
    expect(screen.getByRole("button", { name: "Leave without saving" })).toHaveFocus();
    await user.keyboard("{Tab}");
    expect(screen.getByRole("button", { name: "Stay here" })).toHaveFocus();
    await user.keyboard("{Escape}");

    expect(onStay).toHaveBeenCalledTimes(1);
    expect(onLeave).not.toHaveBeenCalled();
  });

  it("does not discard work when its backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onStay = vi.fn();
    const onLeave = vi.fn();
    render(<LeaveWithoutSavingDialog onLeave={onLeave} onStay={onStay} />);

    const backdrop = document.querySelector(".leave-without-saving-backdrop");
    if (backdrop === null) {
      throw new Error("Expected the leave-without-saving backdrop to render.");
    }

    await user.click(backdrop);

    expect(onStay).not.toHaveBeenCalled();
    expect(onLeave).not.toHaveBeenCalled();
  });
});
