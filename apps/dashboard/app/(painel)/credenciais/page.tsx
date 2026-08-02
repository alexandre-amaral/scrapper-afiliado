import type { Metadata } from "next";
import { AutoRefresh } from "@/components/auto-refresh";
import { AffiliateConnectActions } from "@/components/affiliate-connect-actions";
import { CredentialsForm } from "@/components/credentials-form";
import { SetupHint } from "@/components/setup-hint";
import {
  tryAgent,
  type CredentialsStatus,
  type AffiliateStatus,
} from "@/lib/agent-api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Credenciais" };

const affiliateLabels: Record<string, { text: string; color: string }> = {
  valid: { text: "Conectada", color: "bg-green-500" },
  expired: { text: "Expirada — reconectar", color: "bg-amber-500" },
  unknown: { text: "Não conectada", color: "bg-neutral-500" },
};

export default async function CredenciaisPage() {
  const credResult = await tryAgent<CredentialsStatus>("/credentials");
  const affResult = await tryAgent<AffiliateStatus>("/affiliate/status");

  if (!credResult.ok) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold tracking-tight">Credenciais</h1>
        <SetupHint message={credResult.error} />
      </div>
    );
  }

  const cred = credResult.data;
  const aff = affResult.ok ? affResult.data : null;
  const affSession = aff?.session ?? "unknown";
  const affLabel = affiliateLabels[affSession] ?? affiliateLabels.unknown!;
  const loginRunning = aff?.login.running ?? false;
  // Se o agente ainda não envia o campo (versão antiga), assume GUI disponível.
  const interactiveAvailable = aff?.interactiveAvailable ?? true;

  return (
    <div className="space-y-8">
      {/* Enquanto o login roda, atualiza pra refletir quando concluir. */}
      {loginRunning ? <AutoRefresh seconds={5} /> : null}

      <div>
        <h1 className="text-xl font-semibold tracking-tight">Credenciais</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Chaves de API e conexão da conta de afiliado. Tudo é guardado
          criptografado no agente — os valores sensíveis nunca voltam para esta
          tela.
        </p>
      </div>

      {/* ---------- Conta de afiliado ---------- */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-200">
              Conta de afiliado do Mercado Livre
            </h2>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${affLabel.color}`}
              />
              <span className="text-sm text-neutral-300">{affLabel.text}</span>
            </div>
          </div>
          <AffiliateConnectActions
            loginRunning={loginRunning}
            interactiveAvailable={interactiveAvailable}
            sessionLabel={affSession}
          />
        </div>

        {/* Etiqueta de afiliado — obrigatória para gerar os links (vai no payload do linkbuilder). */}
        <div className="mt-4">
          <CredentialsForm
            submitLabel="Salvar tag"
            inline
            className="flex flex-wrap items-end gap-3"
          >
            <div className="min-w-0 flex-1">
              <label className="text-xs font-medium text-neutral-400">
                Etiqueta de afiliado (tag){" "}
                {cred.affiliateTag ? (
                  <span className="text-green-500">✓ {cred.affiliateTag}</span>
                ) : (
                  <span className="text-amber-400">obrigatória p/ gerar links</span>
                )}
              </label>
              <input
                type="text"
                name="mlAffiliateTag"
                defaultValue={cred.affiliateTag}
                placeholder="ex.: abcd1234567"
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600"
              />
              <p className="mt-1 text-xs text-neutral-500">
                É a etiqueta que aparece em “Etiqueta em uso” no linkbuilder do portal.
              </p>
            </div>
          </CredentialsForm>
        </div>

        <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-950/50 p-4 text-sm text-neutral-400">
          {loginRunning ? (
            <p>
              Uma janela do navegador foi aberta{" "}
              <strong className="text-neutral-200">na máquina do agente</strong>.
              Faça login no portal de afiliados e conclua o 2FA por lá. Assim que
              terminar, os cookies são salvos criptografados e o status acima muda
              para “Conectada”.
            </p>
          ) : interactiveAvailable ? (
            <>
              <p>
                Ao clicar em conectar, o agente abre um navegador na{" "}
                <strong className="text-neutral-200">máquina onde o agente roda</strong>{" "}
                para você logar no portal e aprovar o 2FA — só na primeira vez ou
                quando a sessão expira.
              </p>
              <p className="mt-2 text-neutral-500">
                “Tentar renovar sessão” tenta reaproveitar um login antigo sem abrir
                janela. Use isso se a sessão acabou de expirar.
              </p>
            </>
          ) : (
            <>
              <p className="text-amber-300">
                Este agente está em um servidor sem tela. O botão de conectar abre
                um navegador <strong>no servidor</strong>, não no seu computador —
                por isso não aparecia nada.
              </p>
              <p className="mt-2">
                Use <strong className="text-neutral-200">Tentar renovar sessão</strong>{" "}
                se já houve um login antes. Se falhar, faça o login numa instalação
                local (com tela) e copie a pasta{" "}
                <code className="rounded bg-neutral-900 px-1 text-xs text-neutral-300">
                  data/
                </code>{" "}
                (<span className="text-neutral-500">
                  (affiliate-session.enc + playwright-profile)
                </span>{" "}
                para a VPS, com a mesma{" "}
                <code className="rounded bg-neutral-900 px-1 text-xs text-neutral-300">
                  SESSION_ENCRYPTION_KEY
                </code>
                .
              </p>
            </>
          )}
          {aff?.login.ok === false && aff.login.error ? (
            <p className="mt-3 text-red-300">Falhou: {aff.login.error}</p>
          ) : null}
          {!affResult.ok ? (
            <p className="mt-3 text-amber-300">
              Não foi possível ler o status da sessão: {affResult.error}
            </p>
          ) : null}
        </div>
      </section>

      {/* ---------- Formulário de chaves ---------- */}
      <CredentialsForm
        submitLabel="Salvar credenciais"
        className="space-y-6 rounded-xl border border-neutral-800 bg-neutral-900/50 p-5"
      >
        {/* Gemini */}
        <div>
          <h2 className="text-sm font-semibold text-neutral-200">
            Chave da API Gemini{" "}
            <StatusBadge configured={cred.gemini.configured} source={cred.gemini.source} />
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Usada para ranquear ofertas e compor as mensagens (BYOK). Obtenha em{" "}
            <span className="text-neutral-400">aistudio.google.com/apikey</span>.
          </p>
          <input
            type="password"
            name="geminiKey"
            autoComplete="off"
            placeholder={
              cred.gemini.configured ? "•••••••• (deixe vazio p/ manter)" : "cole a chave aqui"
            }
            className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600"
          />
          {cred.gemini.configured ? (
            <label className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
              <input type="checkbox" name="clearGemini" className="accent-red-500" />
              Remover a chave salva
            </label>
          ) : null}
        </div>

        <div>
          <label className="text-xs font-medium text-neutral-400">
            Modelo LLM
          </label>
          <input
            type="text"
            name="llmModel"
            defaultValue={cred.llmModel}
            placeholder="gemini-2.5-flash"
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
          />
        </div>

        <hr className="border-neutral-800" />

        {/* Mercado Livre API oficial */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-neutral-200">
            API oficial do Mercado Livre{" "}
            <StatusBadge configured={cred.ml.source !== "none"} source={cred.ml.source} />
          </h2>
          <p className="text-xs text-neutral-500">
            Necessária para a fonte automática por palavras-chave. Crie um app no
            DevCenter do ML, salve Client ID e Secret abaixo, e autorize com o
            botão — isso gera o “código de renovação” automaticamente.
          </p>

          <div>
            <label className="text-xs font-medium text-neutral-400">Client ID</label>
            <input
              type="text"
              name="mlClientId"
              defaultValue={cred.ml.clientId}
              placeholder="ex.: 1234567890123456"
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-neutral-400">
              Client Secret{" "}
              {cred.ml.clientSecretConfigured ? (
                <span className="text-green-500">✓ salvo</span>
              ) : null}
            </label>
            <input
              type="password"
              name="mlClientSecret"
              autoComplete="off"
              placeholder={
                cred.ml.clientSecretConfigured ? "•••••••• (vazio p/ manter)" : "cole aqui"
              }
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-neutral-400">
              Código de renovação da API{" "}
              {cred.ml.refreshTokenConfigured ? (
                <span className="text-green-500">✓ salvo</span>
              ) : null}
            </label>
            <p className="mt-0.5 text-xs text-neutral-500">
              Antes chamado “refresh token”. É o que o Mercado Livre usa para
              manter a busca automática de ofertas ligada sem você entrar de novo.
              Prefira o botão “Autorizar app” abaixo em vez de colar na mão.
            </p>
            <input
              type="password"
              name="mlRefreshToken"
              autoComplete="off"
              placeholder={
                cred.ml.refreshTokenConfigured
                  ? "•••••••• (vazio p/ manter)"
                  : "só se for colar manualmente"
              }
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600"
            />
          </div>

          {cred.mlOAuthStartUrl ? (
            <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
              <a
                href={cred.mlOAuthStartUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm font-medium text-yellow-200 transition-colors hover:bg-yellow-500/20"
              >
                Autorizar app do Mercado Livre
              </a>
              <p className="mt-2 text-xs text-neutral-500">
                Abre a tela de permissão do ML no seu navegador e grava o código de
                renovação no agente. No DevCenter, o redirect URI deve ser exatamente:{" "}
                <code className="break-all text-neutral-400">
                  {cred.mlOAuthRedirectUri ?? "(configure PUBLIC_URL no agente)"}
                </code>
              </p>
            </div>
          ) : null}
        </div>
      </CredentialsForm>
    </div>
  );
}

function StatusBadge({
  configured,
  source,
}: {
  configured: boolean;
  source: "dashboard" | "env" | "none";
}) {
  if (!configured) {
    return (
      <span className="ml-1 rounded bg-neutral-800 px-1.5 py-0.5 text-xs font-normal text-neutral-500">
        não configurada
      </span>
    );
  }
  return (
    <span className="ml-1 rounded bg-green-500/15 px-1.5 py-0.5 text-xs font-normal text-green-400">
      configurada{source === "env" ? " (via .env)" : ""}
    </span>
  );
}
