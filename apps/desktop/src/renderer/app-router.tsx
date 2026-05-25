import React, { useMemo, useState } from "react";
import { Button, Card, CardContent } from "@symphony/ui";
import { DashboardRoute } from "@/renderer/routes/dashboard-route";
import { IssuesRoute } from "@/renderer/routes/issues-route";
import { SettingsRoute } from "@/renderer/routes/settings-route";

export type RouteId = "dashboard" | "issues" | "settings";

export function AppRouter(): React.JSX.Element {
  const [route, setRoute] = useState<RouteId>("dashboard");

  const content = useMemo(() => {
    if (route === "issues") return <IssuesRoute />;
    if (route === "settings") return <SettingsRoute />;
    return <DashboardRoute />;
  }, [route]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <Card>
        <CardContent className="pt-6">
          <nav aria-label="Main navigation" className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant={route === "dashboard" ? "default" : "secondary"}
              onClick={() => setRoute("dashboard")}
            >
              Dashboard
            </Button>
            <Button
              type="button"
              variant={route === "issues" ? "default" : "secondary"}
              onClick={() => setRoute("issues")}
            >
              Issues
            </Button>
            <Button
              type="button"
              variant={route === "settings" ? "default" : "secondary"}
              onClick={() => setRoute("settings")}
            >
              Settings
            </Button>
          </nav>
        </CardContent>
      </Card>
      <main>{content}</main>
    </div>
  );
}
