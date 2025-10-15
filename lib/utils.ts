import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function decodeHtmlEntities(text: string): string {
  if (!text) return text;

  // First, decode HTML entities to get a clean string.
  const textArea = document.createElement("textarea");
  textArea.innerHTML = text;
  const decodedText = textArea.value;

  // Then, format any legacy dollar amounts into proper LaTeX.
  return formatLegacyDollarAmounts(decodedText);
}

function formatLegacyDollarAmounts(text: string): string {
  if (!text) return text;

  // Pattern to match legacy dollar amounts: $$[number/decimal]$
  const dollarAmountPattern = /\$\$(\d+(?:[.,]\d+)*)\$/g;

  // Replace with standard LaTeX inline math format: $number$
  // This will render the number as a KaTeX math element.
  return text.replace(dollarAmountPattern, (_match, number) => `\$$${number}$`);
}
