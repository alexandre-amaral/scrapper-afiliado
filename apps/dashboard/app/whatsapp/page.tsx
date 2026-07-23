import type { Metadata } from "next";
import { RefreshButton } from "@/components/refresh-button";
import { AutoRefresh } from "@/components/auto-refresh";
import { SetupHint } from "@/components/setup-hint";
import { tryAgent, type Overview, type QrResponse } from "@/lib/agent-api";
import { whatsappColors, whatsappLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "WhatsApp" };

export default async function WhatsAppPage() {
  const overviewResult = await tryAgent<Overview>("/overview");

  if (!overviewResult.ok) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold tracking-tight">
          Conexão WhatsApp
        </h1>
        <SetupHint message={overviewResult.error} />
      </div>
    );
  }

  const status = overviewResult.data.whatsapp;
  // A Evolution serve um QR válido tanto em "qr" quanto em "connecting"
  // (ela cicla entre os dois enquanto ninguém escaneia). Buscamos em ambos.
  const needsQr =
    status === "qr" || status === "disconnected" || status === "connecting";

  let qr: string | null = null;
  if (needsQr) {
    const qrResult = await tryAgent<QrResponse>("/whatsapp/qr");
    qr = qrResult.ok ? qrResult.data.qr : null;
  }

  const qrSrc = qr
    ? qr.startsWith("data:")
      ? qr
      : `data:image/png;base64,${qr}`
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Conexão WhatsApp
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Estado da sessão do número usado para enviar as ofertas aos grupos.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
        <div className="flex items-center gap-3">
          <span
            className={`inline-block h-3 w-3 rounded-full ${whatsappColors[status]}`}
          />
          <span className="text-sm font-medium text-neutral-200">
            {whatsappLabels[status]}
          </span>
        </div>
        <RefreshButton label="Atualizar status" />
      </div>

      {status === "connected" ? (
        <p className="text-sm text-neutral-400">
          Tudo certo — o número está conectado e pronto para enviar mensagens
          dentro da janela configurada.
        </p>
      ) : null}

      {status === "connecting" && !qrSrc ? (
        <p className="text-sm text-neutral-400">
          Conectando… aguarde alguns segundos e clique em “Atualizar status”.
        </p>
      ) : null}

      {status === "banned" ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
          <p className="font-medium">Número banido pelo WhatsApp.</p>
          <p className="mt-2 text-red-100/70">
            Os envios foram interrompidos. Será necessário um novo chip
            dedicado: aqueça o número com uso manual por 1–2 semanas antes de
            reconectar, e mantenha volume baixo com cadência humana.
          </p>
        </div>
      ) : null}

      {needsQr ? (
        <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
          <h2 className="mb-2 text-sm font-semibold text-neutral-300">
            Parear via QR code
          </h2>
          <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-neutral-400">
            <li>Abra o WhatsApp no celular do número dedicado.</li>
            <li>
              Toque em <strong>Configurações → Dispositivos conectados →
              Conectar dispositivo</strong>.
            </li>
            <li>Aponte a câmera para o QR code abaixo.</li>
            <li>
              O código expira rápido — se falhar, clique em “Gerar novo QR”.
            </li>
          </ol>
          {qrSrc ? (
            <div className="flex flex-col items-start gap-4">
              {/* QR expira rápido — atualiza sozinho enquanto a tela está aberta. */}
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
              <p className="text-sm text-neutral-400">
                QR code ainda não disponível. O agente pode estar iniciando a
                sessão — aguarde alguns segundos e atualize.
              </p>
              <RefreshButton label="Buscar QR code" />
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
