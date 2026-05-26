import type { Config } from "tailwindcss";
import symphonyPreset from "../../tailwind.preset";

const config: Config = {
  presets: [symphonyPreset],
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
};

export default config;
