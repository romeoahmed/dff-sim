import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

// Self-hosted fonts (no Google Fonts / FOIT).
// Plex Sans ships as a variable font (single file, 100-700 weight range).
// Plex Mono is STATIC ONLY -- no variable distribution exists, so import each weight used.
import "@fontsource-variable/ibm-plex-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";

import "../styles/globals.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
