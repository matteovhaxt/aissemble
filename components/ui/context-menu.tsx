"use client";

import {
  CheckboxItem as ContextMenuPrimitiveCheckboxItem,
  Content as ContextMenuPrimitiveContent,
  Group as ContextMenuPrimitiveGroup,
  Item as ContextMenuPrimitiveItem,
  ItemIndicator as ContextMenuPrimitiveItemIndicator,
  Label as ContextMenuPrimitiveLabel,
  Portal as ContextMenuPrimitivePortal,
  RadioGroup as ContextMenuPrimitiveRadioGroup,
  RadioItem as ContextMenuPrimitiveRadioItem,
  Root as ContextMenuPrimitiveRoot,
  Separator as ContextMenuPrimitiveSeparator,
  Sub as ContextMenuPrimitiveSub,
  SubContent as ContextMenuPrimitiveSubContent,
  SubTrigger as ContextMenuPrimitiveSubTrigger,
  Trigger as ContextMenuPrimitiveTrigger,
} from "@radix-ui/react-context-menu";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function ContextMenu({
  ...props
}: ComponentProps<typeof ContextMenuPrimitiveRoot>) {
  return <ContextMenuPrimitiveRoot data-slot="context-menu" {...props} />;
}

function ContextMenuTrigger({
  ...props
}: ComponentProps<typeof ContextMenuPrimitiveTrigger>) {
  return (
    <ContextMenuPrimitiveTrigger data-slot="context-menu-trigger" {...props} />
  );
}

function ContextMenuGroup({
  ...props
}: ComponentProps<typeof ContextMenuPrimitiveGroup>) {
  return (
    <ContextMenuPrimitiveGroup data-slot="context-menu-group" {...props} />
  );
}

function ContextMenuPortal({
  ...props
}: ComponentProps<typeof ContextMenuPrimitivePortal>) {
  return (
    <ContextMenuPrimitivePortal data-slot="context-menu-portal" {...props} />
  );
}

function ContextMenuSub({
  ...props
}: ComponentProps<typeof ContextMenuPrimitiveSub>) {
  return <ContextMenuPrimitiveSub data-slot="context-menu-sub" {...props} />;
}

function ContextMenuRadioGroup({
  ...props
}: ComponentProps<typeof ContextMenuPrimitiveRadioGroup>) {
  return (
    <ContextMenuPrimitiveRadioGroup
      data-slot="context-menu-radio-group"
      {...props}
    />
  );
}

function ContextMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: ComponentProps<typeof ContextMenuPrimitiveSubTrigger> & {
  inset?: boolean;
}) {
  return (
    <ContextMenuPrimitiveSubTrigger
      className={cn(
        "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[inset]:pl-8 data-[state=open]:text-accent-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-inset={inset}
      data-slot="context-menu-sub-trigger"
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto" />
    </ContextMenuPrimitiveSubTrigger>
  );
}

function ContextMenuSubContent({
  className,
  ...props
}: ComponentProps<typeof ContextMenuPrimitiveSubContent>) {
  return (
    <ContextMenuPrimitiveSubContent
      className={cn(
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] origin-(--radix-context-menu-content-transform-origin) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=closed]:animate-out data-[state=open]:animate-in",
        className
      )}
      data-slot="context-menu-sub-content"
      {...props}
    />
  );
}

function ContextMenuContent({
  className,
  ...props
}: ComponentProps<typeof ContextMenuPrimitiveContent>) {
  return (
    <ContextMenuPrimitivePortal>
      <ContextMenuPrimitiveContent
        className={cn(
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-(--radix-context-menu-content-available-height) min-w-[8rem] origin-(--radix-context-menu-content-transform-origin) overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=closed]:animate-out data-[state=open]:animate-in",
          className
        )}
        data-slot="context-menu-content"
        {...props}
      />
    </ContextMenuPrimitivePortal>
  );
}

function ContextMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: ComponentProps<typeof ContextMenuPrimitiveItem> & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <ContextMenuPrimitiveItem
      className={cn(
        "data-[variant=destructive]:*:[svg]:!text-destructive relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[disabled]:opacity-50 data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-inset={inset}
      data-slot="context-menu-item"
      data-variant={variant}
      {...props}
    />
  );
}

function ContextMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: ComponentProps<typeof ContextMenuPrimitiveCheckboxItem>) {
  return (
    <ContextMenuPrimitiveCheckboxItem
      checked={checked}
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-slot="context-menu-checkbox-item"
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <ContextMenuPrimitiveItemIndicator>
          <CheckIcon className="size-4" />
        </ContextMenuPrimitiveItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitiveCheckboxItem>
  );
}

function ContextMenuRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof ContextMenuPrimitiveRadioItem>) {
  return (
    <ContextMenuPrimitiveRadioItem
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-slot="context-menu-radio-item"
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <ContextMenuPrimitiveItemIndicator>
          <CircleIcon className="size-2 fill-current" />
        </ContextMenuPrimitiveItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitiveRadioItem>
  );
}

function ContextMenuLabel({
  className,
  inset,
  ...props
}: ComponentProps<typeof ContextMenuPrimitiveLabel> & { inset?: boolean }) {
  return (
    <ContextMenuPrimitiveLabel
      className={cn(
        "px-2 py-1.5 font-medium text-foreground text-sm data-[inset]:pl-8",
        className
      )}
      data-inset={inset}
      data-slot="context-menu-label"
      {...props}
    />
  );
}

function ContextMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof ContextMenuPrimitiveSeparator>) {
  return (
    <ContextMenuPrimitiveSeparator
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      data-slot="context-menu-separator"
      {...props}
    />
  );
}

function ContextMenuShortcut({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "ml-auto text-muted-foreground text-xs tracking-widest",
        className
      )}
      data-slot="context-menu-shortcut"
      {...props}
    />
  );
}

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
};
