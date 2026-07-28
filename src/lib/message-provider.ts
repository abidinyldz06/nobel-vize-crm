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

export function configuredMessageProvider(): MessageProvider | null {
  const provider = process.env.MESSAGE_PROVIDER?.trim().toLowerCase();
  if (!provider || provider === "disabled") return null;
  throw Object.assign(new Error("message_provider_not_implemented"), {
    code: "message_provider_not_implemented",
  });
}
