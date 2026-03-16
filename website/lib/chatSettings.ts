const API_KEY = "api_key";
const BASE_URL = "base_url";
const MODEL = "model";

const isBrowser = typeof window !== "undefined";

export function getApiKeyFromLocalStorage(): string {
  if (!isBrowser) return "";
  return localStorage.getItem(API_KEY) || "";
}

export function setApiKeyToLocalStorage(key: string) {
  if (!isBrowser) return;
  localStorage.setItem(API_KEY, key);
}

export function getBaseURLFromLocalStorage(): string {
  if (!isBrowser) return "";
  return localStorage.getItem(BASE_URL) || "";
}

export function setBaseURLToLocalStorage(url: string) {
  if (!isBrowser) return;
  localStorage.setItem(BASE_URL, url);
}

function systemPromptKey(robotName?: string) {
  return robotName ? `system_prompt_${robotName}` : "system_prompt";
}

export function getSystemPromptFromLocalStorage(robotName?: string): string {
  if (!isBrowser) return "";
  return localStorage.getItem(systemPromptKey(robotName)) || "";
}

export function setSystemPromptToLocalStorage(
  prompt: string,
  robotName?: string
) {
  if (!isBrowser) return;
  localStorage.setItem(systemPromptKey(robotName), prompt);
}

export function getModelFromLocalStorage(): string {
  if (!isBrowser) return "";
  return localStorage.getItem(MODEL) || "";
}

export function setModelToLocalStorage(model: string) {
  if (!isBrowser) return;
  localStorage.setItem(MODEL, model);
}
