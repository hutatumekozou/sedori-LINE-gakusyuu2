"use client";

import { useEffect, useState, useTransition } from "react";

import { updateFavoriteInlineAction } from "@/actions/study-item-actions";
import { cn } from "@/lib/utils";

type FavoriteToggleProps = {
  itemId: number;
  questionNumber: number;
  isFavorite: boolean;
};

export function FavoriteToggle({
  itemId,
  questionNumber,
  isFavorite,
}: FavoriteToggleProps) {
  const [favorite, setFavorite] = useState(isFavorite);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setFavorite(isFavorite);
  }, [isFavorite]);

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        const nextFavorite = !favorite;
        setFavorite(nextFavorite);

        startTransition(async () => {
          const result = await updateFavoriteInlineAction(itemId, nextFavorite);

          if (!result.success) {
            setFavorite(!nextFavorite);
            window.alert(result.error);
          }
        });
      }}
      className={cn(
        "text-2xl leading-none transition hover:scale-110 disabled:cursor-not-allowed disabled:opacity-60",
        favorite ? "text-amber-400" : "text-slate-300 hover:text-amber-300",
      )}
      aria-label={
        favorite
          ? `問題番号${questionNumber}をお気に入りから外す`
          : `問題番号${questionNumber}をお気に入りにする`
      }
    >
      {favorite ? "★" : "☆"}
    </button>
  );
}
