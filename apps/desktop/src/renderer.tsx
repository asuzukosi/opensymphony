import React from "react";
import { createRoot } from "react-dom/client";
import "@/styles.css";
import "@ui/styles.css";
import { AppRouter } from "@/renderer/app-router";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Missing root container");
}

createRoot(container).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>,
);
