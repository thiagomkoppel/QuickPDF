import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "../presentation/styles/global.css";

const fallback = document.getElementById("legacy-browser-fallback");
if (fallback !== null) fallback.remove();

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("QuickPDF root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
