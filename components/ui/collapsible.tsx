"use client";

import {
  CollapsibleContent as CollapsiblePrimitiveContent,
  Collapsible as CollapsiblePrimitiveRoot,
  CollapsibleTrigger as CollapsiblePrimitiveTrigger,
} from "@radix-ui/react-collapsible";
import type { ComponentProps } from "react";

function Collapsible({
  ...props
}: ComponentProps<typeof CollapsiblePrimitiveRoot>) {
  return <CollapsiblePrimitiveRoot data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({
  ...props
}: ComponentProps<typeof CollapsiblePrimitiveTrigger>) {
  return (
    <CollapsiblePrimitiveTrigger data-slot="collapsible-trigger" {...props} />
  );
}

function CollapsibleContent({
  ...props
}: ComponentProps<typeof CollapsiblePrimitiveContent>) {
  return (
    <CollapsiblePrimitiveContent data-slot="collapsible-content" {...props} />
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
