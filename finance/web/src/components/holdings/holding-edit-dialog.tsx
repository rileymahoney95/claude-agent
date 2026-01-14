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
import { formatCurrency } from "@/lib/utils";
import type { CryptoHolding, AccountHolding } from "@/lib/types";

type HoldingType = "crypto" | "bank" | "other";

interface HoldingEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holding: CryptoHolding | AccountHolding | null;
  type: HoldingType;
  onSave: (data: { value: number; notes?: string }) => void;
  isLoading?: boolean;
}

export function HoldingEditDialog({
  open,
  onOpenChange,
  holding,
  type,
  onSave,
  isLoading = false,
}: HoldingEditDialogProps) {
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Determine if this is a crypto holding
  const isCrypto = type === "crypto";
  const cryptoHolding = isCrypto ? (holding as CryptoHolding) : null;
  const accountHolding = !isCrypto ? (holding as AccountHolding) : null;

  // Get display name for the dialog title
  const displayName = isCrypto
    ? cryptoHolding?.symbol
    : accountHolding?.name || accountHolding?.key;

  // Reset form when holding changes
  useEffect(() => {
    if (holding) {
      if (isCrypto && cryptoHolding) {
        setValue(cryptoHolding.quantity.toString());
        setNotes(cryptoHolding.notes || "");
      } else if (accountHolding) {
        setValue(accountHolding.balance.toString());
        setNotes("");
      }
      setError(null);
    }
  }, [holding, isCrypto, cryptoHolding, accountHolding]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) {
      setError("Please enter a valid non-negative number");
      return;
    }

    onSave({
      value: numValue,
      notes: isCrypto && notes.trim() ? notes.trim() : undefined,
    });
  };

  // Calculate preview value for crypto
  const previewValue =
    isCrypto && cryptoHolding?.price
      ? parseFloat(value) * cryptoHolding.price
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Holding: {displayName}</DialogTitle>
            <DialogDescription>
              {isCrypto
                ? "Update the quantity and notes for this crypto holding."
                : "Update the balance for this account."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label
                htmlFor="value"
                className="text-sm font-medium leading-none"
              >
                {isCrypto ? "Quantity" : "Balance"}
              </label>
              <Input
                id="value"
                type="number"
                step="any"
                min="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={isCrypto ? "0.00" : "$0.00"}
              />
            </div>

            {isCrypto && (
              <div className="space-y-2">
                <label
                  htmlFor="notes"
                  className="text-sm font-medium leading-none"
                >
                  Notes (optional)
                </label>
                <Input
                  id="notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Coinbase, Cold storage"
                />
              </div>
            )}

            {isCrypto && cryptoHolding?.price && (
              <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Price:</span>
                  <span>{formatCurrency(cryptoHolding.price)}</span>
                </div>
                {previewValue !== null && !isNaN(previewValue) && (
                  <div className="flex justify-between font-medium">
                    <span className="text-muted-foreground">New Value:</span>
                    <span className="text-green-600">
                      {formatCurrency(previewValue)}
                    </span>
                  </div>
                )}
              </div>
            )}

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
