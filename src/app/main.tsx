import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { registerQuickPdfServiceWorker } from "../infrastructure/pwa/service-worker-registration";
import "../presentation/styles/global.css";
import { App } from "./App";

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("QuickPDF root element was not found.");
}

if (import.meta.env.PROD) {
  void registerQuickPdfServiceWorker();
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
