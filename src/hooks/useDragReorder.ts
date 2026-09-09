"use client";

import { useCallback, useState } from "react";

export interface DragReorderHandlers {
  draggedId: string | null;
  dragOverId: string | null;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDragLeave: () => void;
  onDrop: (targetId: string | null) => void;
  onDragEnd: () => void;
  isDragOver: (id: string) => boolean;
}

export function useDragReorder(onReorder: (draggedId: string, targetId: string | null) => void) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const onDragStart = useCallback((id: string) => {
    setDraggedId(id);
  }, []);

  const onDragOver = useCallback((id: string) => {
    setDragOverId(id);
  }, []);

  const onDragLeave = useCallback(() => {
    setDragOverId(null);
  }, []);

  const onDrop = useCallback(
    (targetId: string | null) => {
      if (draggedId && draggedId !== targetId) {
        onReorder(draggedId, targetId);
      }
      setDraggedId(null);
      setDragOverId(null);
    },
    [draggedId, onReorder]
  );

  const onDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
  }, []);

  const isDragOver = useCallback(
    (id: string) => dragOverId === id && draggedId !== id,
    [dragOverId, draggedId]
  );

  return {
    draggedId,
    dragOverId,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd,
    isDragOver,
  };
}

export function dragHandleProps(handlers: DragReorderHandlers, id: string) {
  return {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = "move";
      handlers.onDragStart(id);
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      handlers.onDragOver(id);
    },
    onDragLeave: handlers.onDragLeave,
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      handlers.onDrop(id);
    },
    onDragEnd: handlers.onDragEnd,
  };
}

export function emptySlotDragProps(
  handlers: DragReorderHandlers,
  slotKey: string,
  onDropAtIndex?: (draggedId: string) => void
) {
  return {
    onDragEnter: (e: React.DragEvent) => {
      e.preventDefault();
      handlers.onDragOver(slotKey);
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      handlers.onDragOver(slotKey);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (handlers.draggedId && onDropAtIndex) {
        onDropAtIndex(handlers.draggedId);
      } else {
        handlers.onDrop(null);
      }
      handlers.onDragEnd();
    },
  };
}

export function pageNavDropProps(
  handlers: DragReorderHandlers,
  navKey: string,
  onDropNavigate: (draggedId: string) => void,
  dropDisabled = false
) {
  if (dropDisabled) return {};
  return {
    onDragEnter: (e: React.DragEvent) => {
      e.preventDefault();
      handlers.onDragOver(navKey);
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      handlers.onDragOver(navKey);
    },
    onDragLeave: handlers.onDragLeave,
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (handlers.draggedId) {
        onDropNavigate(handlers.draggedId);
      }
      handlers.onDragEnd();
    },
  };
}

/** Binder filled slot: drop moves the dragged card into this slot index (swap if occupied). */
export function binderCardDragProps(
  handlers: DragReorderHandlers,
  cardId: string,
  targetIndex: number,
  moveToSlot: (draggedId: string, targetIndex: number) => void
) {
  return {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = "move";
      const img = (e.currentTarget as HTMLElement).querySelector("img");
      if (img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0) {
        e.dataTransfer.setDragImage(img, img.clientWidth / 2, img.clientHeight / 2);
      }
      handlers.onDragStart(cardId);
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      handlers.onDragOver(cardId);
    },
    onDragLeave: handlers.onDragLeave,
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (handlers.draggedId && handlers.draggedId !== cardId) {
        moveToSlot(handlers.draggedId, targetIndex);
      }
      handlers.onDragEnd();
    },
    onDragEnd: handlers.onDragEnd,
  };
}
