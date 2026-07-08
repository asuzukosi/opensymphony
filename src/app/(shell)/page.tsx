import { IpcSmoke } from "@/components/ipc-smoke";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Open Symphony</h1>
      <p className="text-sm text-muted-foreground">agent orchestration and management</p>
      <IpcSmoke />
      <Button>hello tauri</Button>
    </main>
  );
}
