"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateAutoSendEnabledInlineAction } from "@/actions/study-item-actions";
import { Badge } from "@/components/badge";
import { SubmitButton } from "@/components/submit-button";

type AutoSendToggleProps = {
  itemId: number;
  autoSendEnabled: boolean;
};

export function AutoSendToggle({ itemId, autoSendEnabled }: AutoSendToggleProps) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(autoSendEnabled);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setEnabled(autoSendEnabled);
  }, [autoSendEnabled]);

  return (
    <div className="flex min-w-24 flex-col gap-1.5">
      <Badge
        label={enabled ? "ON" : "OFF"}
        className={enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}
      />
      <SubmitButton
        type="button"
        label="切り替え"
        pendingLabel="更新中..."
        variant="secondary"
        disabled={isPending}
        className="w-full px-2.5 py-1.5 text-[11px]"
        onClick={() => {
          const nextEnabled = !enabled;
          setEnabled(nextEnabled);

          startTransition(async () => {
            const result = await updateAutoSendEnabledInlineAction(itemId, nextEnabled);

            if (!result.success) {
              setEnabled(!nextEnabled);
              window.alert(result.error);
              return;
            }

            router.refresh();
          });
        }}
      />
    </div>
  );
}
