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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TaxSituation } from "@/lib/types";

const FILING_STATUS_OPTIONS = [
  { value: "single", label: "Single" },
  { value: "married_joint", label: "Married Filing Jointly" },
  { value: "married_separate", label: "Married Filing Separately" },
  { value: "separate", label: "Married Filing Separately" }, // Alias
  { value: "head_of_household", label: "Head of Household" },
] as const;

interface TaxFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taxSituation: TaxSituation | null;
  onSave: (data: TaxSituation) => void;
  isLoading?: boolean;
}

export function TaxForm({
  open,
  onOpenChange,
  taxSituation,
  onSave,
  isLoading = false,
}: TaxFormProps) {
  const [filingStatus, setFilingStatus] = useState("single");
  const [federalBracket, setFederalBracket] = useState("");
  const [stateTax, setStateTax] = useState("");
  const [rothMaxed, setRothMaxed] = useState(false);
  const [backdoorRequired, setBackdoorRequired] = useState(false);
  const [has401k, setHas401k] = useState(false);
  const [hsaEligible, setHsaEligible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when tax situation data changes
  useEffect(() => {
    if (taxSituation) {
      setFilingStatus(taxSituation.filing_status || "single");
      setFederalBracket(taxSituation.federal_bracket?.toString() || "");
      setStateTax(taxSituation.state_tax?.toString() || "");
      setRothMaxed(taxSituation.roth_maxed ?? false);
      setBackdoorRequired(taxSituation.backdoor_required ?? false);
      setHas401k(taxSituation.has_401k ?? false);
      setHsaEligible(taxSituation.hsa_eligible ?? false);
      setError(null);
    }
  }, [taxSituation, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate federal bracket
    const federalNum = parseFloat(federalBracket);
    if (isNaN(federalNum) || federalNum < 0 || federalNum > 100) {
      setError("Please enter a valid federal bracket percentage (0-100)");
      return;
    }

    // Validate state tax
    const stateNum = parseFloat(stateTax);
    if (isNaN(stateNum) || stateNum < 0 || stateNum > 100) {
      setError("Please enter a valid state tax percentage (0-100)");
      return;
    }

    onSave({
      filing_status: filingStatus,
      federal_bracket: federalNum,
      state_tax: stateNum,
      roth_maxed: rothMaxed,
      backdoor_required: backdoorRequired,
      has_401k: has401k,
      hsa_eligible: hsaEligible,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Tax Situation</DialogTitle>
            <DialogDescription>
              Update your tax filing status and retirement account settings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="filingStatus">Filing Status</Label>
              <Select value={filingStatus} onValueChange={setFilingStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select filing status" />
                </SelectTrigger>
                <SelectContent>
                  {FILING_STATUS_OPTIONS.filter(
                    (opt, idx, arr) =>
                      arr.findIndex((o) => o.label === opt.label) === idx
                  ).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="federalBracket">Federal Bracket (%)</Label>
              <div className="relative">
                <Input
                  id="federalBracket"
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  value={federalBracket}
                  onChange={(e) => setFederalBracket(e.target.value)}
                  className="pr-8"
                  placeholder="25"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  %
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stateTax">State Tax (%)</Label>
              <div className="relative">
                <Input
                  id="stateTax"
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  value={stateTax}
                  onChange={(e) => setStateTax(e.target.value)}
                  className="pr-8"
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  %
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rothMaxed"
                  checked={rothMaxed}
                  onCheckedChange={(checked) =>
                    setRothMaxed(checked === true)
                  }
                />
                <Label htmlFor="rothMaxed" className="font-normal">
                  Roth IRA Maxed
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="backdoorRequired"
                  checked={backdoorRequired}
                  onCheckedChange={(checked) =>
                    setBackdoorRequired(checked === true)
                  }
                />
                <Label htmlFor="backdoorRequired" className="font-normal">
                  Backdoor Roth Required
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has401k"
                  checked={has401k}
                  onCheckedChange={(checked) => setHas401k(checked === true)}
                />
                <Label htmlFor="has401k" className="font-normal">
                  Has 401(k)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hsaEligible"
                  checked={hsaEligible}
                  onCheckedChange={(checked) =>
                    setHsaEligible(checked === true)
                  }
                />
                <Label htmlFor="hsaEligible" className="font-normal">
                  HSA Eligible
                </Label>
              </div>
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
