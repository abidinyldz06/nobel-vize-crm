"use client";

import { useFormStatus } from "react-dom";

/**
 * Çift gönderim korumalı submit butonu.
 *
 * Sorun: klasik <form action={serverAction}> akışında buton submit
 * sonrası kilitlenmez; sunucu 2-3 saniye işlerken ikinci tık ya da
 * tarayıcı tekrar gönderimi ikinci bir müşteri kaydı açabiliyordu
 * (gönderim 9 Eylül 2026 canlı olayı).
 *
 * Çözüm: React 19 useFormStatus ile buton submit anında disabled olur,
 * "Kaydediliyor..." durumuna geçer ve form tekrar gönderilemez.
 * Sunucu tarafı advisory-lock + possible_duplicate_customer koruması
 * zaten var; bu bileşen yarışı istemci tarafında kökten bitirir.
 */
export function SubmitButton({
  pendingLabel = "Kaydediliyor...",
  children,
  className,
}: {
  pendingLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={className}
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <svg
            className="animate-spin h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}