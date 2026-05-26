import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@symphony/ui/styles.css";
import { AppRouter } from "@/renderer/app-router";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Missing root container");
}

createRoot(container).render(
  <React.StrictMode>
    <HashRouter>
      <AppRouter />
    </HashRouter>
  </React.StrictMode>,
);
