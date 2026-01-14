"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Goal } from "@/lib/types";

type GoalType = "short_term" | "medium_term" | "long_term";

const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  short_term: "Short-term",
  medium_term: "Medium-term",
  long_term: "Long-term",
};

interface GoalEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: Goal | null;
  goalType: GoalType;
  onSave: (data: Goal) => void;
  isLoading?: boolean;
}

export function GoalEditDialog({
  open,
  onOpenChange,
  goal,
  goalType,
  onSave,
  isLoading = false,
}: GoalEditDialogProps) {
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset form when goal data changes
  useEffect(() => {
    if (goal) {
      setDescription(goal.description || "");
      setTarget(goal.target?.toString() || "");
      setDeadline(goal.deadline || "");
      setError(null);
    }
  }, [goal, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!description.trim()) {
      setError("Please enter a goal description");
      return;
    }

    // Validate target if provided
    let targetValue: number | null = null;
    if (target.trim()) {
      const num = parseFloat(target);
      if (isNaN(num) || num < 0) {
        setError("Please enter a valid non-negative target amount");
        return;
      }
      targetValue = num;
    }

    // Validate deadline format if provided (YYYY-MM)
    let deadlineValue: string | null = null;
    if (deadline.trim()) {
      const deadlineRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
      if (!deadlineRegex.test(deadline)) {
        setError("Please enter deadline in YYYY-MM format (e.g., 2026-08)");
        return;
      }
      deadlineValue = deadline;
    }

    onSave({
      description: description.trim(),
      target: targetValue,
      deadline: deadlineValue,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              Edit {GOAL_TYPE_LABELS[goalType]} Goal
            </DialogTitle>
            <DialogDescription>
              Update your goal description, target amount, and deadline.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is your goal?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="target">Target Amount (optional)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="target"
                  type="number"
                  step="any"
                  min="0"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="pl-7"
                  placeholder="Leave blank if not quantifiable"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline (optional)</Label>
              <Input
                id="deadline"
                type="month"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                placeholder="YYYY-MM"
              />
              <p className="text-xs text-muted-foreground">
                Format: YYYY-MM (e.g., 2026-08)
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
