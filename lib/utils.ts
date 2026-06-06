import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * shadcn/ui 标准 cn() helper：合并 className 并解决 Tailwind 冲突
 * 例子：cn("px-2 py-1", condition && "bg-red-500", "px-4") → "py-1 bg-red-500 px-4"
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
