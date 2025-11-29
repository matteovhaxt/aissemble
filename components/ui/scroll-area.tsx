"use client";

import {
  Corner as ScrollAreaPrimitiveCorner,
  Root as ScrollAreaPrimitiveRoot,
  ScrollAreaScrollbar as ScrollAreaPrimitiveScrollbar,
  ScrollAreaThumb as ScrollAreaPrimitiveThumb,
  Viewport as ScrollAreaPrimitiveViewport,
} from "@radix-ui/react-scroll-area";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function ScrollArea({
  className,
  children,
  ...props
}: ComponentProps<typeof ScrollAreaPrimitiveRoot>) {
  return (
    <ScrollAreaPrimitiveRoot
      className={cn("relative", className)}
      data-slot="scroll-area"
      {...props}
    >
      <ScrollAreaPrimitiveViewport
        className="size-full rounded-[inherit] outline-none transition-[color,box-shadow] focus-visible:outline-1 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        data-slot="scroll-area-viewport"
      >
        {children}
      </ScrollAreaPrimitiveViewport>
      <ScrollBar />
      <ScrollAreaPrimitiveCorner />
    </ScrollAreaPrimitiveRoot>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: ComponentProps<typeof ScrollAreaPrimitiveScrollbar>) {
  return (
    <ScrollAreaPrimitiveScrollbar
      className={cn(
        "flex touch-none select-none p-px transition-colors",
        orientation === "vertical" &&
          "h-full w-2.5 border-l border-l-transparent",
        orientation === "horizontal" &&
          "h-2.5 flex-col border-t border-t-transparent",
        className
      )}
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      {...props}
    >
      <ScrollAreaPrimitiveThumb
        className="relative flex-1 rounded-full bg-border"
        data-slot="scroll-area-thumb"
      />
    </ScrollAreaPrimitiveScrollbar>
  );
}

export { ScrollArea, ScrollBar };
