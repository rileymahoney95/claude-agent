"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FilterOption = "all" | "goals" | "rebalance" | "opportunities";

interface PriorityFilterProps {
  selected: FilterOption;
  onChange: (filter: FilterOption) => void;
  disabled?: boolean;
}

const FILTER_OPTIONS: { value: FilterOption; label: string }[] = [
  { value: "all", label: "All" },
  { value: "goals", label: "Goals" },
  { value: "rebalance", label: "Rebalance" },
  { value: "opportunities", label: "Opportunities" },
];

export function PriorityFilter({
  selected,
  onChange,
  disabled = false,
}: PriorityFilterProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {FILTER_OPTIONS.map((option) => (
        <Button
          key={option.value}
          variant={selected === option.value ? "default" : "outline"}
          size="sm"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={cn(
            "transition-colors",
            selected === option.value && "pointer-events-none"
          )}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
