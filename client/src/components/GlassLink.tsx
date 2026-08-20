"use client";

import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { Link } from "wouter";

type GlassLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
};

/**
 * Drop-in replacement for wouter's Link that preserves middle-click / cmd-click
 * behavior. Internal clicks go through wouter (which triggers the glass
 * transition in CinematicTransition); modified clicks act like normal links.
 */
export function GlassLink({ href, onClick, children, ...rest }: GlassLinkProps) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    const isModified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
    if (isModified || rest.target === "_blank") return; // let the browser handle it
    onClick?.(e);
  };

  return (
    <Link href={href} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
}
