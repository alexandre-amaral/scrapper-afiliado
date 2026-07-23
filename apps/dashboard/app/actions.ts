"use server";

import { revalidatePath } from "next/cache";
import { agentFetch, type AgentSettings } from "@/lib/agent-api";

function requireId(formData: FormData): string {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    throw new Error("Identificador ausente no formulário.");
  }
  return id;
}

function optionalNumber(formData: FormData, name: string): number | undefined {
  const raw = formData.get(name);
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function commaList(formData: FormData, name: string): string[] {
  return String(formData.get(name) ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function approveMessage(formData: FormData): Promise<void> {
  const id = requireId(formData);
  const body = formData.get("body");
  // Salva a edição pendente antes de aprovar, se o texto veio no formulário.
  if (typeof body === "string" && body.trim() !== "") {
    await agentFetch(`/messages/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ body }),
    });
  }
  await agentFetch(`/messages/${id}/approve`, { method: "POST" });
  revalidatePath("/aprovacao");
  revalidatePath("/");
}

export async function rejectMessage(formData: FormData): Promise<void> {
  const id = requireId(formData);
  await agentFetch(`/messages/${id}/reject`, { method: "POST" });
  revalidatePath("/aprovacao");
  revalidatePath("/");
}

export async function updateMessage(formData: FormData): Promise<void> {
  const id = requireId(formData);
  const body = String(formData.get("body") ?? "");
  const scheduledFor = formData.get("scheduledFor");
  const payload: { body: string; scheduledFor?: string } = { body };
  if (typeof scheduledFor === "string" && scheduledFor.trim() !== "") {
    payload.scheduledFor = scheduledFor;
  }
  await agentFetch(`/messages/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  revalidatePath("/aprovacao");
  revalidatePath("/");
}

export async function submitManualUrls(formData: FormData): Promise<void> {
  const urls = String(formData.get("urls") ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (urls.length === 0) return;
  await agentFetch("/manual", {
    method: "POST",
    body: JSON.stringify({ urls }),
  });
  revalidatePath("/fontes");
  revalidatePath("/");
}

export async function patchSettings(formData: FormData): Promise<void> {
  const payload: Partial<AgentSettings> = {
    filters: {
      minDiscountPct: optionalNumber(formData, "minDiscountPct") ?? 0,
      minPrice: optionalNumber(formData, "minPrice") ?? 0,
      maxPrice: optionalNumber(formData, "maxPrice") ?? 0,
      dedupWindowHours: optionalNumber(formData, "dedupWindowHours") ?? 0,
      blockedSellers: commaList(formData, "blockedSellers"),
      blockedCategories: commaList(formData, "blockedCategories"),
    },
    autoApprove: formData.get("autoApprove") === "on",
    sendWindowStart: String(formData.get("sendWindowStart") ?? ""),
    sendWindowEnd: String(formData.get("sendWindowEnd") ?? ""),
    sendIntervalMinutes: optionalNumber(formData, "sendIntervalMinutes") ?? 0,
    sendJitterMinutes: optionalNumber(formData, "sendJitterMinutes") ?? 0,
    composerPrompt: String(formData.get("composerPrompt") ?? ""),
    keywords: commaList(formData, "keywords"),
    rankTopN: optionalNumber(formData, "rankTopN") ?? 0,
  };
  await agentFetch("/settings", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  revalidatePath("/configuracoes");
  revalidatePath("/");
}

export async function patchGroup(formData: FormData): Promise<void> {
  const id = requireId(formData);
  const payload: { enabled: boolean; maxPerDay?: number } = {
    enabled: formData.get("enabled") === "on",
  };
  const maxPerDay = optionalNumber(formData, "maxPerDay");
  if (maxPerDay !== undefined) payload.maxPerDay = maxPerDay;
  await agentFetch(`/groups/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  revalidatePath("/grupos");
}

export async function triggerCollect(): Promise<void> {
  await agentFetch("/collect", { method: "POST", body: JSON.stringify({}) });
  revalidatePath("/");
  revalidatePath("/fontes");
}

export async function togglePause(formData: FormData): Promise<void> {
  const currentlyPaused = formData.get("paused") === "true";
  await agentFetch("/settings", {
    method: "PATCH",
    body: JSON.stringify({ paused: !currentlyPaused }),
  });
  revalidatePath("/");
  revalidatePath("/configuracoes");
}
