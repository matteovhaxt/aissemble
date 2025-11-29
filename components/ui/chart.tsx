"use client";

import {
  type ComponentProps,
  type ComponentType,
  type CSSProperties,
  createContext,
  type ReactNode,
  useContext,
  useId,
  useMemo,
} from "react";
import {
  Legend as RechartsLegend,
  type LegendProps as RechartsLegendProps,
  ResponsiveContainer as RechartsResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";

import { cn } from "@/lib/utils";

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = {
  [k in string]: {
    label?: ReactNode;
    icon?: ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  );
};

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = createContext<ChartContextProps | null>(null);

function useChart() {
  const context = useContext(ChartContext);

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }

  return context;
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: ComponentProps<"div"> & {
  config: ChartConfig;
  children: ComponentProps<typeof RechartsResponsiveContainer>["children"];
}) {
  const uniqueId = useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-hidden [&_.recharts-surface]:outline-hidden",
          className
        )}
        data-chart={chartId}
        data-slot="chart"
        {...props}
      >
        <ChartStyle config={config} id={chartId} />
        <RechartsResponsiveContainer>{children}</RechartsResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, itemConfig]) => itemConfig.theme || itemConfig.color
  );

  if (!colorConfig.length) {
    return null;
  }

  const styleContent = Object.entries(THEMES)
    .map(
      ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color =
      itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||
      itemConfig.color;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .join("\n")}
}
`
    )
    .join("\n");

  return <style>{styleContent}</style>;
};

const ChartTooltip = RechartsTooltip;

function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  labelClassName,
  formatter,
  color,
  nameKey,
  labelKey,
}: ComponentProps<typeof RechartsTooltip> &
  ComponentProps<"div"> & {
    hideLabel?: boolean;
    hideIndicator?: boolean;
    indicator?: "line" | "dot" | "dashed";
    nameKey?: string;
    labelKey?: string;
  }) {
  const { config } = useChart();

  const tooltipLabel = useMemo(() => {
    if (hideLabel || !payload?.length) {
      return null;
    }

    const [item] = payload;
    const key = `${labelKey || item?.dataKey || item?.name || "value"}`;
    const itemConfig = getPayloadConfigFromPayload(config, item, key);
    const value =
      !labelKey && typeof label === "string"
        ? config[label as keyof typeof config]?.label || label
        : itemConfig?.label;

    if (labelFormatter) {
      return (
        <div className={cn("font-medium", labelClassName)}>
          {labelFormatter(value, payload)}
        </div>
      );
    }

    if (!value) {
      return null;
    }

    return <div className={cn("font-medium", labelClassName)}>{value}</div>;
  }, [
    label,
    labelFormatter,
    payload,
    hideLabel,
    labelClassName,
    config,
    labelKey,
  ]);

  if (!(active && payload?.length)) {
    return null;
  }

  const nestLabel = payload.length === 1 && indicator !== "dot";
  const filteredPayload = payload.filter((item) => item.type !== "none");
  const leadingLabel = nestLabel ? null : tooltipLabel;

  return (
    <div
      className={cn(
        "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
        className
      )}
    >
      {leadingLabel}
      <div className="grid gap-1.5">
        {filteredPayload.map((item, index) => {
          const key = `${nameKey || item.name || item.dataKey || "value"}`;
          const itemConfig = getPayloadConfigFromPayload(config, item, key);
          const indicatorColor = color || item.payload.fill || item.color;
          const formatFn = typeof formatter === "function" ? formatter : null;
          const canFormat =
            formatFn !== null &&
            item?.value !== undefined &&
            Boolean(item.name);
          let rowContent: ReactNode;
          if (!canFormat || formatFn === null) {
            rowContent = (
              <DefaultTooltipRow
                hideIndicator={hideIndicator}
                indicator={indicator}
                indicatorColor={indicatorColor}
                item={item}
                itemConfig={itemConfig}
                nestLabel={nestLabel}
                tooltipLabel={tooltipLabel}
              />
            );
          } else {
            rowContent = formatFn(
              item.value,
              item.name as string,
              item,
              index,
              item.payload
            );
          }

          return (
            <div
              className={cn(
                "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                indicator === "dot" ? "items-center" : null
              )}
              key={item.dataKey}
            >
              {rowContent}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ChartLegend = RechartsLegend;

function ChartLegendContent({
  className,
  hideIcon = false,
  payload,
  verticalAlign = "bottom",
  nameKey,
}: ComponentProps<"div"> &
  Pick<RechartsLegendProps, "payload" | "verticalAlign"> & {
    hideIcon?: boolean;
    nameKey?: string;
  }) {
  const { config } = useChart();

  if (!payload?.length) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-4",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className
      )}
    >
      {payload
        .filter((item) => item.type !== "none")
        .map((item) => {
          const key = `${nameKey || item.dataKey || "value"}`;
          const itemConfig = getPayloadConfigFromPayload(config, item, key);
          const Icon = itemConfig?.icon;
          const iconMarkup: ReactNode =
            !hideIcon && Icon ? (
              <Icon />
            ) : (
              <div
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{
                  backgroundColor: item.color,
                }}
              />
            );

          return (
            <div
              className={cn(
                "flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"
              )}
              key={item.value}
            >
              {iconMarkup}
              {itemConfig?.label}
            </div>
          );
        })}
    </div>
  );
}

// Helper to extract item config from a payload.
function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: unknown,
  key: string
) {
  if (typeof payload !== "object" || payload === null) {
    return;
  }

  const payloadPayload =
    "payload" in payload &&
    typeof payload.payload === "object" &&
    payload.payload !== null
      ? payload.payload
      : undefined;

  let configLabelKey: string = key;

  if (
    key in payload &&
    typeof payload[key as keyof typeof payload] === "string"
  ) {
    configLabelKey = payload[key as keyof typeof payload] as string;
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key as keyof typeof payloadPayload] === "string"
  ) {
    configLabelKey = payloadPayload[
      key as keyof typeof payloadPayload
    ] as string;
  }

  return configLabelKey in config
    ? config[configLabelKey]
    : config[key as keyof typeof config];
}

type TooltipItem = NonNullable<
  ComponentProps<typeof RechartsTooltip>["payload"]
>[number];

type DefaultTooltipRowProps = {
  hideIndicator: boolean;
  indicator: "line" | "dot" | "dashed";
  indicatorColor: string | undefined;
  item: TooltipItem;
  itemConfig: ChartConfig[string] | undefined;
  nestLabel: boolean;
  tooltipLabel: ReactNode;
};

function DefaultTooltipRow({
  hideIndicator,
  indicator,
  indicatorColor,
  item,
  itemConfig,
  nestLabel,
  tooltipLabel,
}: DefaultTooltipRowProps) {
  let indicatorElement: ReactNode = null;
  if (itemConfig?.icon) {
    const Icon = itemConfig.icon;
    indicatorElement = <Icon />;
  } else if (!hideIndicator) {
    const shouldOffsetDashedIndicator = nestLabel && indicator === "dashed";
    const indicatorClasses = cn(
      "shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)",
      indicator === "dot" ? "h-2.5 w-2.5" : null,
      indicator === "line" ? "w-1" : null,
      indicator === "dashed"
        ? "w-0 border-[1.5px] border-dashed bg-transparent"
        : null,
      shouldOffsetDashedIndicator ? "my-0.5" : null
    );
    indicatorElement = (
      <div
        className={indicatorClasses}
        style={
          {
            "--color-bg": indicatorColor,
            "--color-border": indicatorColor,
          } as CSSProperties
        }
      />
    );
  }

  const rowLabel = nestLabel ? tooltipLabel : null;
  const valueMarkup =
    item.value !== undefined ? (
      <span className="font-medium font-mono text-foreground tabular-nums">
        {item.value.toLocaleString()}
      </span>
    ) : null;

  return (
    <>
      {indicatorElement}
      <div
        className={cn(
          "flex flex-1 justify-between leading-none",
          nestLabel ? "items-end" : "items-center"
        )}
      >
        <div className="grid gap-1.5">
          {rowLabel}
          <span className="text-muted-foreground">
            {itemConfig?.label || item.name}
          </span>
        </div>
        {valueMarkup}
      </div>
    </>
  );
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
};
