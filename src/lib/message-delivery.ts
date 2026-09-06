import type { MessageProvider, OutboxMessage, ProviderAccepted } from "./message-provider";

export type DeliveryMessage = OutboxMessage & {
  customer_id: string;
  purpose: string;
};

export type DeliveryDependencies = {
  isAllowed: (message: DeliveryMessage) => Promise<boolean>;
  provider: MessageProvider;
  recordBlocked: () => Promise<void>;
  recordAccepted: (result: ProviderAccepted) => Promise<void>;
  recordSendError: (error: unknown) => Promise<void>;
};

/** DB failures propagate; only provider failures may enter the send retry path. */
export async function deliverClaimedMessage(
  message: DeliveryMessage,
  dependencies: DeliveryDependencies,
): Promise<"accepted" | "blocked" | "failed"> {
  if (!await dependencies.isAllowed(message)) {
    await dependencies.recordBlocked();
    return "blocked";
  }

  let result: ProviderAccepted;
  try {
    result = await dependencies.provider.send(message);
  } catch (error) {
    await dependencies.recordSendError(error);
    return "failed";
  }

  // A successful provider send must not be counted until its receipt is saved.
  // If persistence fails, leave the lease in place for reconciliation/retry.
  await dependencies.recordAccepted(result);
  return "accepted";
}
