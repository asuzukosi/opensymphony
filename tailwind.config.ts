import type { Config } from "tailwindcss";
import opensymphonyPreset from "./tailwind.preset";

const config: Config = {
  presets: [opensymphonyPreset],
  content: ["./src/**/*.{ts,tsx}"],
};

export default config;
