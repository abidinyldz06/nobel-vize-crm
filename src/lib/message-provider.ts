import "server-only";

export type OutboxMessage = {
  id: string;
  channel: "email" | "whatsapp";
  recipient: string;
  subject: string | null;
  body: string;
  idempotency_key: string;
};

export type ProviderAccepted = {
  providerName: string;
  providerMessageId: string;
};

export interface MessageProvider {
  readonly name: string;
  send(message: OutboxMessage): Promise<ProviderAccepted>;
}

type FetchLike = typeof fetch;

export type MessageProviderStatus = {
  provider: "disabled" | "resend" | "unsupported";
  emailDeliveryEnabled: boolean;
  configurationError: string | null;
};

function providerError(code: string) {
  return Object.assign(new Error(code), { code });
}

function environmentValue(name: string) {
  const value = process.env[name]?.trim();
  return value || null;
}

export function messageProviderStatus(): MessageProviderStatus {
  const configured = environmentValue("MESSAGE_PROVIDER")?.toLowerCase() ?? "disabled";
  if (configured === "disabled") {
    return { provider: "disabled", emailDeliveryEnabled: false, configurationError: null };
  }
  if (configured !== "resend") {
    return { provider: "unsupported", emailDeliveryEnabled: false, configurationError: "message_provider_unsupported" };
  }

  const missing = ["RESEND_API_KEY", "EMAIL_FROM"].filter(name => !environmentValue(name));
  return {
    provider: "resend",
    emailDeliveryEnabled: missing.length === 0,
    configurationError: missing.length === 0 ? null : "message_provider_configuration_missing",
  };
}

export function createResendMessageProvider(
  input: {
    apiKey: string;
    from: string;
    replyTo?: string | null;
    fetchImpl?: FetchLike;
  },
): MessageProvider {
  const apiKey = input.apiKey.trim();
  const from = input.from.trim();
  const replyTo = input.replyTo?.trim() || null;
  const fetchImpl = input.fetchImpl ?? fetch;

  if (!apiKey || !from) throw providerError("message_provider_configuration_missing");

  return {
    name: "resend",
    async send(message) {
      if (message.channel !== "email") throw providerError("message_channel_not_supported");

      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": message.idempotency_key,
        },
        body: JSON.stringify({
          from,
          to: [message.recipient],
          subject: message.subject || "Nobel Vize bilgilendirmesi",
          text: message.body,
          ...(replyTo ? { reply_to: replyTo } : {}),
        }),
      });

      const payload = await response.json().catch(() => null) as { id?: unknown; name?: unknown; message?: unknown } | null;
      if (!response.ok) {
        const providerCode = typeof payload?.name === "string"
          ? payload.name
          : `resend_http_${response.status}`;
        throw providerError(`resend_${providerCode.replace(/[^A-Za-z0-9_.:/-]/g, "_").slice(0, 100)}`);
      }
      if (!payload || typeof payload.id !== "string" || payload.id.length < 8 || payload.id.length > 200) {
        throw providerError("resend_invalid_response");
      }
      return { providerName: "resend", providerMessageId: payload.id };
    },
  };
}

export function configuredMessageProvider(): MessageProvider | null {
  const status = messageProviderStatus();
  if (status.provider === "disabled") return null;
  if (status.provider !== "resend" || !status.emailDeliveryEnabled) {
    throw providerError(status.configurationError ?? "message_provider_not_implemented");
  }
  return createResendMessageProvider({
    apiKey: environmentValue("RESEND_API_KEY")!,
    from: environmentValue("EMAIL_FROM")!,
    replyTo: environmentValue("EMAIL_REPLY_TO"),
  });
}
