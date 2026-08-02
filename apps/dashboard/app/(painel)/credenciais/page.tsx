import type { Metadata } from "next";
import { AutoRefresh } from "@/components/auto-refresh";
import { AffiliateConnectActions } from "@/components/affiliate-connect-actions";
import { AffiliateCookieImport } from "@/components/affiliate-cookie-import";
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
  const needsSession = affSession !== "valid";

  return (
    <div className="space-y-8">
      {/* Enquanto o login roda, atualiza pra refletir quando concluir. */}
      {loginRunning ? <AutoRefresh seconds={5} /> : null}

      <div>
        <h1 className="text-xl font-semibold tracking-tight">Credenciais</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Duas coisas diferentes: a conta de afiliado (para gerar links com
          comissão) e a API oficial (só se quiser busca automática por
          palavras-chave). Tudo fica criptografado no agente — valores
          sensíveis nunca voltam para esta tela.
        </p>
      </div>

      {/* ---------- Conta de afiliado ---------- */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-200">
              1. Conta de afiliado (links com comissão)
            </h2>
            <p className="mt-1 max-w-xl text-xs text-neutral-500">
              É o login no portal de afiliados. Sem essa sessão, o agente não
              consegue transformar um produto em link que paga comissão. Não
              tem relação com o “código de renovação da API” abaixo.
            </p>
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
                janela. Se o agente estiver num servidor sem tela, use o fluxo de
                colar cookies abaixo.
              </p>
            </>
          ) : (
            <>
              <p className="text-amber-300">
                Este agente está em um servidor sem tela — o botão Conectar não
                aparece porque abriria um navegador no servidor, não no seu
                computador.
              </p>
              <p className="mt-2">
                Use o bloco{" "}
                <strong className="text-neutral-200">Colar cookies da sessão</strong>{" "}
                abaixo: login no seu Chrome + exportar cookies. Se já conectou
                antes, “Tentar renovar sessão” pode bastar.
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

        {/* Fluxo principal em VPS; também útil como alternativa com GUI. */}
        <AffiliateCookieImport emphasized={!interactiveAvailable || needsSession} />
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
            2. Busca automática na API do Mercado Livre{" "}
            <StatusBadge configured={cred.ml.source !== "none"} source={cred.ml.source} />
          </h2>
          <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-3 text-xs text-neutral-400">
            <p>
              <strong className="font-medium text-neutral-200">É opcional.</strong>{" "}
              Serve só para o agente procurar ofertas sozinho por palavras-chave
              na API oficial. Se você cola URLs na mão ou usa a coleta pela
              página pública (scraper), pode deixar tudo desta seção em branco —
              os links de comissão continuam vindo da conta de afiliado acima.
            </p>
            <p className="mt-2 text-neutral-500">
              Se quiser a busca por palavras-chave: crie um app no DevCenter do
              ML, salve Client ID e Secret, e use o botão “Autorizar app” — ele
              grava o código de renovação sozinho.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-neutral-400">
              Client ID{" "}
              <span className="font-normal text-neutral-600">· opcional</span>
            </label>
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
              <span className="font-normal text-neutral-600">· opcional</span>{" "}
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
              <span className="font-normal text-neutral-600">· opcional</span>{" "}
              {cred.ml.refreshTokenConfigured ? (
                <span className="text-green-500">✓ salvo</span>
              ) : null}
            </label>
            <p className="mt-0.5 text-xs text-neutral-500">
              <strong className="font-medium text-neutral-300">É obrigatório?</strong>{" "}
              Não, na maioria dos casos. Só é necessário se você ativar a busca
              automática por palavras-chave na API. Não é o login da conta de
              afiliado e não gera link de comissão. Prefira o botão “Autorizar
              app” em vez de colar na mão.
            </p>
            <input
              type="password"
              name="mlRefreshToken"
              autoComplete="off"
              placeholder={
                cred.ml.refreshTokenConfigured
                  ? "•••••••• (vazio p/ manter)"
                  : "deixe vazio se não usa a API"
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
                Só use se quiser a busca por palavras-chave. Abre a permissão do
                ML no seu navegador e grava o código de renovação no agente. No
                DevCenter, o redirect URI deve ser exatamente:{" "}
                <code className="break-all text-neutral-400">
                  {cred.mlOAuthRedirectUri}
                </code>
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200/90">
              Para autorizar o app do ML pelo navegador, o agente precisa da URL
              pública HTTPS em{" "}
              <code className="text-amber-100">PUBLIC_URL</code> (ex.: a mesma
              do painel). Sem isso o botão de autorizar não aparece — evita
              apontar para um endereço local inválido em produção. A busca por
              palavras-chave é opcional; os links de comissão vêm da conta de
              afiliado acima.
            </div>
          )}
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
