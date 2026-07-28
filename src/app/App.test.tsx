import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { App } from "./App";

const renderAt = (path: string) => {
  window.history.pushState({}, "", path);
  return render(<App />);
};

describe("QuickPDF application shell", () => {
  it("renders the landing page with the product name, product statement, and accurate privacy promise", () => {
    renderAt("/");

    expect(screen.getByRole("heading", { level: 1, name: "QuickPDF" })).toBeInTheDocument();
    expect(screen.getByText("Fill, sign, fix, and download a PDF in minutes.")).toBeInTheDocument();
    expect(
      screen.getByText("Your PDF is processed in your browser and is not uploaded to us."),
    ).toBeInTheDocument();
  });

  it("shows a disabled PDF selection placeholder without implying document features work", () => {
    renderAt("/");

    expect(screen.getByRole("button", { name: /pdf selection coming later/i })).toBeDisabled();
    expect(screen.queryByText(/upload your pdf/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/start editing now/i)).not.toBeInTheDocument();
  });

  it("navigates by keyboard from the landing page to the editor shell", async () => {
    const user = userEvent.setup();
    renderAt("/");

    await user.tab();
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "QuickPDF home" })).toHaveFocus();
    await user.tab();
    const editorLink = screen.getByRole("link", { name: "Open editor shell" });
    expect(editorLink).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("heading", { level: 1, name: "Editor shell" })).toBeInTheDocument();
  });

  it("renders the editor route as a placeholder shell only", () => {
    renderAt("/editor");

    expect(screen.getByRole("heading", { level: 1, name: "Editor shell" })).toBeInTheDocument();
    expect(
      screen.getByText(
        /PDF loading, rendering, editing, signing, and export are not implemented yet./i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /download/i })).not.toBeInTheDocument();
  });

  it("renders a not-found page for unknown routes", () => {
    renderAt("/missing-route");

    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to QuickPDF home" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("uses a semantic responsive shell structure", () => {
    renderAt("/");

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });
});
