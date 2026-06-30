import {
  format,
  subDays,
  subMonths,
  subYears,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from "date-fns";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type DateRangePreset =
  | "all"
  | "today"
  | "yesterday"
  | "last7days"
  | "lastMonth"
  | "thisYear"
  | "lastYear"
  | "custom";

const PRESET_OPTIONS: { value: Exclude<DateRangePreset, "all" | "custom">; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7days", label: "Last 7 Days" },
  { value: "lastMonth", label: "Last Month" },
  { value: "thisYear", label: "This Year" },
  { value: "lastYear", label: "Last Year" },
];

export function getPresetRange(
  preset: Exclude<DateRangePreset, "all" | "custom">,
): { from: string; to: string } {
  const now = new Date();
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");
  switch (preset) {
    case "today":
      return { from: fmt(now), to: fmt(now) };
    case "yesterday": {
      const y = subDays(now, 1);
      return { from: fmt(y), to: fmt(y) };
    }
    case "last7days":
      return { from: fmt(subDays(now, 6)), to: fmt(now) };
    case "lastMonth": {
      const lastMonth = subMonths(now, 1);
      return { from: fmt(startOfMonth(lastMonth)), to: fmt(endOfMonth(lastMonth)) };
    }
    case "thisYear":
      return { from: fmt(startOfYear(now)), to: fmt(endOfYear(now)) };
    case "lastYear": {
      const lastYear = subYears(now, 1);
      return { from: fmt(startOfYear(lastYear)), to: fmt(endOfYear(lastYear)) };
    }
  }
}

interface DateRangeFilterProps {
  preset: DateRangePreset;
  onPresetChange: (preset: DateRangePreset) => void;
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  /** Whether an "All Time" (no filter) option is offered. Default true. */
  allowAllTime?: boolean;
  label?: string;
  className?: string;
}

export function DateRangeFilter({
  preset,
  onPresetChange,
  from,
  to,
  onChange,
  allowAllTime = true,
  label,
  className,
}: DateRangeFilterProps) {
  function handlePresetSelect(value: string) {
    const next = value as DateRangePreset;
    onPresetChange(next);
    if (next === "all") {
      onChange("", "");
    } else if (next !== "custom") {
      const range = getPresetRange(next);
      onChange(range.from, range.to);
    }
  }

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className ?? ""}`}>
      {label && <span className="text-sm text-muted-foreground shrink-0">{label}</span>}
      <Select value={preset} onValueChange={handlePresetSelect}>
        <SelectTrigger className="w-[150px] h-9 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allowAllTime && <SelectItem value="all">All Time</SelectItem>}
          {PRESET_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
          <SelectItem value="custom">Custom Range</SelectItem>
        </SelectContent>
      </Select>
      {preset === "custom" && (
        <>
          <Input
            type="date"
            className="text-sm h-9 w-[150px]"
            value={from}
            onChange={(e) => onChange(e.target.value, to)}
          />
          <span className="text-muted-foreground text-xs shrink-0">to</span>
          <Input
            type="date"
            className="text-sm h-9 w-[150px]"
            value={to}
            onChange={(e) => onChange(from, e.target.value)}
          />
        </>
      )}
      {allowAllTime && preset !== "all" && (
        <button
          type="button"
          onClick={() => {
            onPresetChange("all");
            onChange("", "");
          }}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Clear date filter"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
