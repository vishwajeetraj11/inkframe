"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

interface TimelineResizeHandleProps {
  height: number;
  minHeight: number;
  maxHeight: number;
  defaultHeight: number;
  onHeightChange: (height: number) => void;
}

const clampHeight = (height: number, minHeight: number, maxHeight: number) =>
  Math.min(maxHeight, Math.max(minHeight, Math.round(height)));

export const TimelineResizeHandle = ({
  height,
  minHeight,
  maxHeight,
  defaultHeight,
  onHeightChange,
}: TimelineResizeHandleProps) => {
  const dragStartRef = useRef<{ height: number; pointerY: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const updateHeight = (nextHeight: number) => {
    onHeightChange(clampHeight(nextHeight, minHeight, maxHeight));
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = { height, pointerY: event.clientY };
    setIsDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const dragStart = dragStartRef.current;
    if (!dragStart) return;
    updateHeight(dragStart.height + dragStart.pointerY - event.clientY);
  };

  const finishDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStartRef.current = null;
    setIsDragging(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      updateHeight(height + 16);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      updateHeight(height - 16);
    } else if (event.key === "Home") {
      event.preventDefault();
      updateHeight(minHeight);
    } else if (event.key === "End") {
      event.preventDefault();
      updateHeight(maxHeight);
    }
  };

  return (
    <button
      type="button"
      role="separator"
      aria-label="Resize timeline"
      aria-orientation="horizontal"
      aria-valuemin={minHeight}
      aria-valuemax={maxHeight}
      aria-valuenow={height}
      title="Drag to resize timeline. Double-click to reset."
      onDoubleClick={() => updateHeight(defaultHeight)}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      className={`group absolute inset-x-0 -top-2 z-30 hidden h-4 touch-none cursor-row-resize items-center justify-center outline-none xl:flex ${
        isDragging ? "bg-cyan-300/10" : "hover:bg-white/[0.035]"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-0.5 w-12 transition group-focus-visible:w-20 ${
          isDragging ? "bg-cyan-300" : "bg-white/25 group-hover:bg-cyan-300"
        }`}
      />
    </button>
  );
};
