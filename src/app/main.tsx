import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

// Body text uses the platform SF Pro stack (see --font-sans in globals.css).
// Plex Mono remains self-hosted for the .readout class — instrument numerics
// demand a predictable tabular-nums mono that doesn't depend on the OS.
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
