import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/renderer/layout/app-shell";
import { Agents } from "@/renderer/routes/agents";
import { Board } from "@/renderer/routes/board";
import { Dashboard } from "@/renderer/routes/dashboard";
import { Issue } from "@/renderer/routes/issue";
import { Settings } from "@/renderer/routes/settings";

export function AppRouter(): React.JSX.Element {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="board" element={<Board />} />
        <Route path="agents" element={<Agents />} />
        <Route path="issues/:id" element={<Issue />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
