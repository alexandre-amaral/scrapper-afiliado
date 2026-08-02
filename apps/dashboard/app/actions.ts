"use server";

import { revalidatePath } from "next/cache";
import { actionErr, actionOk, type ActionResult } from "@/lib/action-result";
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
      // Preço vazio = sem limite (null), não 0 — o schema exige > 0 ou null.
      minPrice: optionalNumber(formData, "minPrice") ?? null,
      maxPrice: optionalNumber(formData, "maxPrice") ?? null,
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

export async function syncGroups(): Promise<ActionResult> {
  try {
    await agentFetch("/groups/sync", { method: "POST", body: JSON.stringify({}) });
    revalidatePath("/grupos");
    return actionOk("Grupos sincronizados.");
  } catch (err) {
    return actionErr(err);
  }
}

export async function triggerCollect(): Promise<ActionResult> {
  try {
    await agentFetch("/collect", { method: "POST", body: JSON.stringify({}) });
    revalidatePath("/");
    revalidatePath("/fontes");
    return actionOk("Coleta iniciada.");
  } catch (err) {
    return actionErr(err);
  }
}

export async function saveCredentials(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    // Só enviamos campos preenchidos: string vazia limpa, ausente não mexe.
    // (Sensíveis com placeholder "••••" no form vêm vazios se não editados.)
    const payload: Record<string, string> = {};
    const put = (key: string, formKey: string) => {
      const raw = formData.get(formKey);
      if (typeof raw === "string" && raw.trim() !== "") payload[key] = raw.trim();
    };
    // Campos que suportam "limpar" explicitamente via checkbox.
    const clear = (key: string, formKey: string) => {
      if (formData.get(formKey) === "on") payload[key] = "";
    };

    put("GOOGLE_GENERATIVE_AI_API_KEY", "geminiKey");
    clear("GOOGLE_GENERATIVE_AI_API_KEY", "clearGemini");
    put("LLM_MODEL", "llmModel");
    put("ML_CLIENT_ID", "mlClientId");
    put("ML_CLIENT_SECRET", "mlClientSecret");
    put("ML_REFRESH_TOKEN", "mlRefreshToken");
    put("ML_AFFILIATE_TAG", "mlAffiliateTag");

    await agentFetch("/credentials", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    revalidatePath("/credenciais");
    revalidatePath("/");
    return actionOk("Credenciais salvas.");
  } catch (err) {
    return actionErr(err);
  }
}

export async function connectAffiliate(
  _prev: ActionResult | null,
  _formData: FormData,
): Promise<ActionResult> {
  try {
    // Dispara o login interativo — abre um Chromium na máquina do agente.
    await agentFetch("/affiliate/connect", {
      method: "POST",
      body: JSON.stringify({}),
    });
    revalidatePath("/credenciais");
    return actionOk(
      "Janela de login pedida na máquina do agente. Complete o login e o 2FA por lá (até 5 minutos).",
    );
  } catch (err) {
    return actionErr(err);
  }
}

export async function refreshAffiliateSession(
  _prev: ActionResult | null,
  _formData: FormData,
): Promise<ActionResult> {
  try {
    const result = await agentFetch<{ ok: boolean; error?: string; session?: string }>(
      "/affiliate/refresh",
      { method: "POST", body: JSON.stringify({}) },
    );
    revalidatePath("/credenciais");
    revalidatePath("/");
    if (result.ok === false) {
      return actionErr(result.error ?? "Não foi possível renovar a sessão.");
    }
    return actionOk("Sessão do portal renovada com sucesso.");
  } catch (err) {
    return actionErr(err);
  }
}

export async function importAffiliateCookies(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const cookies = String(formData.get("cookies") ?? "").trim();
    if (!cookies) {
      return actionErr("Cole os cookies no campo antes de salvar.");
    }
    const result = await agentFetch<{
      ok: boolean;
      error?: string;
      cookieCount?: number;
      session?: string;
    }>("/affiliate/session", {
      method: "POST",
      body: JSON.stringify({ cookies }),
    });
    revalidatePath("/credenciais");
    revalidatePath("/");
    if (result.ok === false) {
      return actionErr(result.error ?? "Não foi possível importar a sessão.");
    }
    const count = result.cookieCount ?? 0;
    const status =
      result.session === "valid"
        ? "Sessão conectada."
        : "Cookies salvos — o status pode levar alguns segundos para atualizar.";
    return actionOk(`${status} (${count} cookies).`);
  } catch (err) {
    return actionErr(err);
  }
}

export async function togglePause(formData: FormData): Promise<ActionResult> {
  try {
    const currentlyPaused = formData.get("paused") === "true";
    await agentFetch("/settings", {
      method: "PATCH",
      body: JSON.stringify({ paused: !currentlyPaused }),
    });
    revalidatePath("/");
    revalidatePath("/configuracoes");
    return actionOk(currentlyPaused ? "Disparos retomados." : "Disparos pausados.");
  } catch (err) {
    return actionErr(err);
  }
}
