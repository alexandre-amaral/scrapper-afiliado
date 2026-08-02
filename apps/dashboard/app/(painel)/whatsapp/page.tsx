import type { Metadata } from "next";
import { RefreshButton } from "@/components/refresh-button";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageHeader } from "@/components/page-header";
import { SetupHint } from "@/components/setup-hint";
import { tryAgent, type Overview, type QrResponse } from "@/lib/agent-api";
import { whatsappColors, whatsappLabels } from "@/lib/labels";
import { ui } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "WhatsApp" };

export default async function WhatsAppPage() {
  const overviewResult = await tryAgent<Overview>("/overview");

  if (!overviewResult.ok) {
    return (
      <div className="space-y-6">
        <PageHeader title="Conexão WhatsApp" />
        <SetupHint message={overviewResult.error} />
      </div>
    );
  }

  const status = overviewResult.data.whatsapp;
  const needsQr =
    status === "qr" || status === "disconnected" || status === "connecting";

  let qr: string | null = null;
  let qrError: string | null = null;
  if (needsQr) {
    const qrResult = await tryAgent<QrResponse>("/whatsapp/qr");
    if (qrResult.ok) {
      qr = qrResult.data.qr;
      qrError = qrResult.data.error ?? null;
    } else {
      qrError = qrResult.error;
    }
  }

  const qrSrc = qr
    ? qr.startsWith("data:")
      ? qr
      : /^[A-Za-z0-9+/=]+$/.test(qr) && !qr.startsWith("2@")
        ? `data:image/png;base64,${qr}`
        : null
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conexão WhatsApp"
        description="Estado da sessão do número usado para enviar as ofertas aos grupos."
      />

      <div
        className={`${ui.card} flex flex-wrap items-center justify-between gap-4`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`inline-block h-3 w-3 rounded-full ${whatsappColors[status]}`}
          />
          <span className="font-display text-lg font-semibold text-ink">
            {whatsappLabels[status]}
          </span>
        </div>
        <RefreshButton label="Atualizar status" />
      </div>

      {status === "connected" ? (
        <p className="text-sm text-mute">
          Tudo certo — o número está conectado e pronto para enviar mensagens
          dentro da janela configurada.
        </p>
      ) : null}

      {status === "connecting" && !qrSrc ? (
        <p className="text-sm text-mute">
          Conectando… aguarde alguns segundos e clique em “Atualizar status”.
        </p>
      ) : null}

      {status === "banned" ? (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-5 text-sm text-danger">
          <p className="font-medium">Número banido pelo WhatsApp.</p>
          <p className="mt-2 text-danger/80">
            Os envios foram interrompidos. Será necessário um novo chip
            dedicado: aqueça o número com uso manual por 1–2 semanas antes de
            reconectar, e mantenha volume baixo com cadência humana.
          </p>
        </div>
      ) : null}

      {needsQr ? (
        <section className={ui.card}>
          <h2 className="mb-2 text-sm font-semibold text-ink">
            Parear via QR code
          </h2>
          <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-mute">
            <li>Abra o WhatsApp no celular do número dedicado.</li>
            <li>
              Toque em{" "}
              <strong className="text-ink">
                Configurações → Dispositivos conectados → Conectar dispositivo
              </strong>
              .
            </li>
            <li>Aponte a câmera para o QR code abaixo.</li>
            <li>
              O código expira rápido — se falhar, clique em “Gerar novo QR”.
            </li>
          </ol>
          {qrSrc ? (
            <div className="flex flex-col items-start gap-4">
              <AutoRefresh seconds={20} />
              <div className="rounded-xl bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrSrc}
                  alt="QR code para conectar o WhatsApp"
                  width={256}
                  height={256}
                  className="h-64 w-64"
                />
              </div>
              <RefreshButton label="Gerar novo QR" />
            </div>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-mute">
                {qrError ??
                  "QR code ainda não disponível. O agente pode estar iniciando a sessão — aguarde alguns segundos e atualize."}
              </p>
              <AutoRefresh seconds={8} />
              <RefreshButton label="Buscar QR code" />
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
