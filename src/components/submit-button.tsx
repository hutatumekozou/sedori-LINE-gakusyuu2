"use client";

import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

type SubmitButtonProps = {
  label: string;
  pendingLabel?: string;
  className?: string;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
};

export function SubmitButton({
  label,
  pendingLabel,
  className,
  variant = "primary",
  disabled = false,
  type = "submit",
  onClick,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      className={cn(
        "rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary"
          ? "bg-slate-950 text-white hover:bg-slate-800"
          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
        className,
      )}
    >
      {isDisabled ? pendingLabel || "処理中..." : label}
    </button>
  );
}
