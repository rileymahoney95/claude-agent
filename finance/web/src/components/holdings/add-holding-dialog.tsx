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

type HoldingType = "crypto" | "bank" | "other";

interface AddHoldingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: HoldingType;
  existingKeys: string[];
  onAdd: (data: {
    key: string;
    value: number;
    name?: string;
    notes?: string;
  }) => void;
  isLoading?: boolean;
}

export function AddHoldingDialog({
  open,
  onOpenChange,
  type,
  existingKeys,
  onAdd,
  isLoading = false,
}: AddHoldingDialogProps) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isCrypto = type === "crypto";

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setKey("");
      setValue("");
      setName("");
      setNotes("");
      setError(null);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate key
    const normalizedKey = isCrypto ? key.toUpperCase().trim() : key.toLowerCase().trim();
    if (!normalizedKey) {
      setError(isCrypto ? "Please enter a symbol" : "Please enter an account key");
      return;
    }

    // Check for duplicates
    const keyToCheck = isCrypto ? normalizedKey : normalizedKey;
    if (existingKeys.map((k) => k.toLowerCase()).includes(keyToCheck.toLowerCase())) {
      setError(`A holding with this ${isCrypto ? "symbol" : "key"} already exists`);
      return;
    }

    // Validate value
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) {
      setError("Please enter a valid non-negative number");
      return;
    }

    onAdd({
      key: normalizedKey,
      value: numValue,
      name: !isCrypto && name.trim() ? name.trim() : undefined,
      notes: isCrypto && notes.trim() ? notes.trim() : undefined,
    });
  };

  const getTitle = () => {
    switch (type) {
      case "crypto":
        return "Add Cryptocurrency";
      case "bank":
        return "Add Bank Account";
      case "other":
        return "Add Account";
    }
  };

  const getDescription = () => {
    switch (type) {
      case "crypto":
        return "Add a new cryptocurrency holding to track.";
      case "bank":
        return "Add a bank account to track.";
      case "other":
        return "Add another account (HSA, etc.) to track.";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{getTitle()}</DialogTitle>
            <DialogDescription>{getDescription()}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {isCrypto ? (
              <>
                <div className="space-y-2">
                  <label
                    htmlFor="symbol"
                    className="text-sm font-medium leading-none"
                  >
                    Symbol
                  </label>
                  <Input
                    id="symbol"
                    type="text"
                    value={key}
                    onChange={(e) => setKey(e.target.value.toUpperCase())}
                    placeholder="BTC, ETH, SOL..."
                    maxLength={10}
                  />
                  <p className="text-xs text-muted-foreground">
                    Supported: BTC, ETH, SOL, DOGE, ADA, XRP, AVAX, DOT, MATIC,
                    LINK
                  </p>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="quantity"
                    className="text-sm font-medium leading-none"
                  >
                    Quantity
                  </label>
                  <Input
                    id="quantity"
                    type="number"
                    step="any"
                    min="0"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

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
                    placeholder="e.g., Coinbase, Ledger"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label
                    htmlFor="key"
                    className="text-sm font-medium leading-none"
                  >
                    Account Key
                  </label>
                  <Input
                    id="key"
                    type="text"
                    value={key}
                    onChange={(e) =>
                      setKey(e.target.value.toLowerCase().replace(/\s+/g, "_"))
                    }
                    placeholder="hysa, checking, hsa..."
                  />
                  <p className="text-xs text-muted-foreground">
                    A short identifier (no spaces, lowercase)
                  </p>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="name"
                    className="text-sm font-medium leading-none"
                  >
                    Display Name
                  </label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="High-Yield Savings Account"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="balance"
                    className="text-sm font-medium leading-none"
                  >
                    Balance
                  </label>
                  <Input
                    id="balance"
                    type="number"
                    step="any"
                    min="0"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </>
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
              {isLoading ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
