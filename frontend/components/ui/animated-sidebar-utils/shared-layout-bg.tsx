"use client";

// Not part of the pasted component source (beui.dev): our implementation of the
// API that animated-sidebar.tsx uses. One hover pill glides between the direct
// children instead of each item fading its own background.

import { motion, useReducedMotion } from "motion/react";
import { type ElementType, forwardRef, type HTMLAttributes, type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { SPRING_LAYOUT } from "./ease";

export interface SharedLayoutBgProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  /** Vertical inset of the pill inside the hovered child, in px. */
  inset?: number;
  pillClassName?: string;
  pillContainerClassName?: string;
  children?: ReactNode;
}

export const SharedLayoutBg = forwardRef<HTMLElement, SharedLayoutBgProps>(function SharedLayoutBg(
  { as: Tag = "div", inset = 0, pillClassName, pillContainerClassName, className, children, onPointerOver, onPointerLeave, ...props },
  ref,
) {
  const reduce = useReducedMotion() ?? false;
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);

  const pill = {
    "aria-hidden": true,
    "data-shared-bg-pill": "",
    initial: false,
    animate: box ? { opacity: 1, y: box.top, height: box.height } : { opacity: 0 },
    transition: reduce ? { duration: 0 } : SPRING_LAYOUT,
    className: cn("pointer-events-none absolute inset-x-0 top-0 z-0 list-none", pillContainerClassName, pillClassName),
  } as const;

  return (
    <Tag
      {...props}
      ref={ref}
      className={cn("relative", className)}
      onPointerOver={(event: React.PointerEvent<HTMLElement>) => {
        onPointerOver?.(event);
        const root = event.currentTarget;
        let child = event.target as HTMLElement | null;
        while (child && child.parentElement !== root) child = child.parentElement;
        if (child && !child.hasAttribute("data-shared-bg-pill")) {
          setBox({ top: child.offsetTop + inset, height: child.offsetHeight - inset * 2 });
        }
      }}
      onPointerLeave={(event: React.PointerEvent<HTMLElement>) => {
        onPointerLeave?.(event);
        setBox(null);
      }}
    >
      {/* A list may only contain <li>, so the pill matches its parent. */}
      {Tag === "ul" || Tag === "ol" ? <motion.li {...pill} /> : <motion.span {...pill} />}
      {children}
    </Tag>
  );
});
