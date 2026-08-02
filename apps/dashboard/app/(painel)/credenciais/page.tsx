import type { Metadata } from "next";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageHeader } from "@/components/page-header";
import { SetupHint } from "@/components/setup-hint";
import { saveCredentials, connectAffiliate } from "@/app/actions";
import {
  tryAgent,
  type CredentialsStatus,
  type AffiliateStatus,
} from "@/lib/agent-api";
import { ui } from "@/lib/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Credenciais" };

const affiliateLabels: Record<string, { text: string; color: string }> = {
  valid: { text: "Conectada", color: "bg-success" },
  expired: { text: "Expirada — reconectar", color: "bg-warning" },
  unknown: { text: "Não conectada", color: "bg-mute" },
};

export default async function CredenciaisPage() {
  const credResult = await tryAgent<CredentialsStatus>("/credentials");
  const affResult = await tryAgent<AffiliateStatus>("/affiliate/status");

  if (!credResult.ok) {
    return (
      <div className="space-y-6">
        <PageHeader title="Credenciais" />
        <SetupHint message={credResult.error} />
      </div>
    );
  }

  const cred = credResult.data;
  const aff = affResult.ok ? affResult.data : null;
  const affSession = aff?.session ?? "unknown";
  const affLabel = affiliateLabels[affSession] ?? affiliateLabels.unknown!;
  const loginRunning = aff?.login.running ?? false;

  return (
    <div className="space-y-8">
      {loginRunning ? <AutoRefresh seconds={5} /> : null}

      <PageHeader
        title="Credenciais"
        description="Chaves de API e conexão da conta de afiliado. Tudo é guardado criptografado no agente — os valores sensíveis nunca voltam para esta tela."
      />

      <section className={ui.card}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">
              Conta de afiliado do Mercado Livre
            </h2>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${affLabel.color}`}
              />
              <span className="text-sm text-ink/90">{affLabel.text}</span>
            </div>
          </div>
          <form action={connectAffiliate}>
            <button
              type="submit"
              disabled={loginRunning}
              className={ui.btnPrimary}
            >
              {loginRunning
                ? "Aguardando login…"
                : affSession === "valid"
                  ? "Reconectar conta"
                  : "Conectar conta de afiliado"}
            </button>
          </form>
        </div>

        <div className="mt-4">
          <form action={saveCredentials} className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <label className={ui.label}>
                Etiqueta de afiliado (tag){" "}
                {cred.affiliateTag ? (
                  <span className="text-success">✓ {cred.affiliateTag}</span>
                ) : (
                  <span className="text-warning">obrigatória p/ gerar links</span>
                )}
              </label>
              <input
                type="text"
                name="mlAffiliateTag"
                defaultValue={cred.affiliateTag}
                placeholder="ex.: abcd1234567"
                className={ui.input}
              />
              <p className="mt-1 text-xs text-mute">
                É a etiqueta que aparece em “Etiqueta em uso” no linkbuilder do
                portal.
              </p>
            </div>
            <button type="submit" className={ui.btnSecondary}>
              Salvar tag
            </button>
          </form>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-elevated/50 p-4 text-sm text-mute">
          {loginRunning ? (
            <p>
              Uma janela do navegador foi aberta{" "}
              <strong className="text-ink">na máquina do agente</strong>. Faça
              login no portal de afiliados e conclua o 2FA por lá. Assim que
              terminar, os cookies são salvos criptografados e o status acima
              muda para “Conectada”.
            </p>
          ) : (
            <>
              <p>
                Ao clicar, o agente abre um navegador (Playwright) para você
                logar no portal de afiliados e aprovar o 2FA manualmente — só na
                primeira vez ou quando a sessão expira.
              </p>
              <p className="mt-2 text-warning/80">
                Funciona rodando localmente. Numa VPS sem interface gráfica, o
                login precisa ser feito de outra forma (sessão headless
                pré-aquecida).
              </p>
            </>
          )}
          {aff?.login.ok === false && aff.login.error ? (
            <p className="mt-3 text-danger">Falhou: {aff.login.error}</p>
          ) : null}
        </div>
      </section>

      <form action={saveCredentials} className={`${ui.card} space-y-6`}>
        <div>
          <h2 className="text-sm font-semibold text-ink">
            Chave da API Gemini{" "}
            <StatusBadge
              configured={cred.gemini.configured}
              source={cred.gemini.source}
            />
          </h2>
          <p className="mt-1 text-xs text-mute">
            Usada para ranquear ofertas e compor as mensagens (BYOK). Obtenha em{" "}
            <span className="text-ink/70">aistudio.google.com/apikey</span>.
          </p>
          <input
            type="password"
            name="geminiKey"
            autoComplete="off"
            placeholder={
              cred.gemini.configured
                ? "•••••••• (deixe vazio p/ manter)"
                : "cole a chave aqui"
            }
            className={`mt-2 ${ui.input}`}
          />
          {cred.gemini.configured ? (
            <label className="mt-2 flex items-center gap-2 text-xs text-mute">
              <input type="checkbox" name="clearGemini" className="accent-danger" />
              Remover a chave salva
            </label>
          ) : null}
        </div>

        <div>
          <label className={ui.label}>Modelo LLM</label>
          <input
            type="text"
            name="llmModel"
            defaultValue={cred.llmModel}
            placeholder="gemini-2.5-flash"
            className={ui.input}
          />
        </div>

        <hr className="border-border" />

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-ink">
            API oficial do Mercado Livre{" "}
            <StatusBadge
              configured={cred.ml.source !== "none"}
              source={cred.ml.source}
            />
          </h2>
          <p className="text-xs text-mute">
            Crie um app no DevCenter do ML. Necessária para a fonte automática
            por palavras-chave.
          </p>

          <div>
            <label className={ui.label}>Client ID</label>
            <input
              type="text"
              name="mlClientId"
              defaultValue={cred.ml.clientId}
              placeholder="ex.: 1234567890123456"
              className={ui.input}
            />
          </div>

          <div>
            <label className={ui.label}>
              Client Secret{" "}
              {cred.ml.clientSecretConfigured ? (
                <span className="text-success">✓ salvo</span>
              ) : null}
            </label>
            <input
              type="password"
              name="mlClientSecret"
              autoComplete="off"
              placeholder={
                cred.ml.clientSecretConfigured
                  ? "•••••••• (vazio p/ manter)"
                  : "cole aqui"
              }
              className={ui.input}
            />
          </div>

          <div>
            <label className={ui.label}>
              Refresh Token{" "}
              {cred.ml.refreshTokenConfigured ? (
                <span className="text-success">✓ salvo</span>
              ) : null}
            </label>
            <input
              type="password"
              name="mlRefreshToken"
              autoComplete="off"
              placeholder={
                cred.ml.refreshTokenConfigured
                  ? "•••••••• (vazio p/ manter)"
                  : "cole aqui"
              }
              className={ui.input}
            />
          </div>
        </div>

        <button type="submit" className={ui.btnPrimary}>
          Salvar credenciais
        </button>
      </form>
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
      <span className="ml-1 rounded-full bg-elevated px-1.5 py-0.5 text-xs font-normal text-mute">
        não configurada
      </span>
    );
  }
  return (
    <span className="ml-1 rounded-full bg-success/15 px-1.5 py-0.5 text-xs font-normal text-success">
      configurada{source === "env" ? " (via .env)" : ""}
    </span>
  );
}
