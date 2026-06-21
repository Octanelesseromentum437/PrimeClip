import { invoke } from "@tauri-apps/api/core";
import type { ProviderKind } from "../lib/types";

export async function storeApiKey(kind: ProviderKind, key: string): Promise<void> {
  await invoke("store_api_key", { kind, key });
}

export async function getApiKey(kind: ProviderKind): Promise<string | null> {
  return invoke<string | null>("get_api_key", { kind });
}

export async function deleteApiKey(kind: ProviderKind): Promise<void> {
  await invoke("delete_api_key", { kind });
}

export async function listConfiguredProviders(): Promise<ProviderKind[]> {
  return invoke<ProviderKind[]>("list_configured_providers");
}

export async function getApiBaseUrl(): Promise<string> {
  return invoke<string>("get_api_base_url");
}

export async function openOutputFolder(path: string): Promise<void> {
  await invoke("open_output_folder", { path });
}

export async function getBundleProfile(): Promise<string> {
  return invoke<string>("get_bundle_profile");
}
