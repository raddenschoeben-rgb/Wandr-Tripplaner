import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmtCost(value: number | null | undefined, symbol: string): string {
  if (value == null) return `${symbol}0`;
  return `${symbol}${value.toLocaleString("en-US")}`;
}
