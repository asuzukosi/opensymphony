import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export const wrapText = "min-w-0 max-w-full break-words [overflow-wrap:anywhere]";

export const wrapTextPreserve =
  "min-w-0 max-w-full break-words [overflow-wrap:anywhere] whitespace-pre-wrap";

export function summarizeText(text: string, maxLength = 72): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
