import type { Config } from "tailwindcss";
import symphonyPreset from "./tailwind.preset";

const config: Config = {
  presets: [symphonyPreset],
  content: ["./src/**/*.{ts,tsx}"],
};

export default config;
