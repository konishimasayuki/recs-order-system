"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton({
  children,
  className = "submit-btn",
  pendingLabel = "処理中…",
  confirmMessage
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  confirmMessage?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
