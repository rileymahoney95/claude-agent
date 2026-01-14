"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorCard } from "@/components/ui/error-card";
import { CryptoTable } from "@/components/holdings/crypto-table";
import { AccountTable } from "@/components/holdings/account-table";
import { StalenessWarning } from "@/components/holdings/staleness-warning";
import { HoldingEditDialog } from "@/components/holdings/holding-edit-dialog";
import { AddHoldingDialog } from "@/components/holdings/add-holding-dialog";
import {
  useHoldings,
  useHoldingsFreshness,
  useUpdateHolding,
  useDeleteHolding,
} from "@/lib/hooks/use-holdings";
import { formatDate } from "@/lib/utils";
import type { CryptoHolding, AccountHolding } from "@/lib/types";

type HoldingType = "crypto" | "bank" | "other";
type EditingHolding =
  | { type: "crypto"; holding: CryptoHolding }
  | { type: "bank" | "other"; holding: AccountHolding };

export default function HoldingsPage() {
  // Data fetching
  const {
    data: holdingsData,
    isLoading,
    error,
    refetch,
  } = useHoldings();
  const { data: freshnessData } = useHoldingsFreshness();

  // Mutations
  const updateHolding = useUpdateHolding();
  const deleteHolding = useDeleteHolding();

  // Dialog states
  const [editingHolding, setEditingHolding] = useState<EditingHolding | null>(
    null
  );
  const [addingType, setAddingType] = useState<HoldingType | null>(null);

  // Calculate totals from holdings data
  const cryptoTotal =
    holdingsData?.crypto.reduce((sum, h) => sum + (h.value || 0), 0) || 0;
  const bankTotal =
    holdingsData?.bank_accounts.reduce((sum, h) => sum + h.balance, 0) || 0;
  const otherTotal =
    holdingsData?.other.reduce((sum, h) => sum + h.balance, 0) || 0;

  // Handlers
  const handleEditCrypto = (holding: CryptoHolding) => {
    setEditingHolding({ type: "crypto", holding });
  };

  const handleEditAccount = (type: "bank" | "other", holding: AccountHolding) => {
    setEditingHolding({ type, holding });
  };

  const handleDeleteCrypto = async (symbol: string) => {
    await deleteHolding.mutateAsync({ category: "crypto", key: symbol });
  };

  const handleDeleteAccount = async (category: "bank" | "other", key: string) => {
    await deleteHolding.mutateAsync({ category, key });
  };

  const handleSaveEdit = async (data: { value: number; notes?: string }) => {
    if (!editingHolding) return;

    const category = editingHolding.type;
    const key =
      editingHolding.type === "crypto"
        ? (editingHolding.holding as CryptoHolding).symbol
        : (editingHolding.holding as AccountHolding).key;

    const result = await updateHolding.mutateAsync({
      category,
      key,
      value: data.value,
      notes: data.notes,
    });

    if (result.success) {
      setEditingHolding(null);
    }
  };

  const handleAdd = async (data: {
    key: string;
    value: number;
    name?: string;
    notes?: string;
  }) => {
    if (!addingType) return;

    const result = await updateHolding.mutateAsync({
      category: addingType,
      key: data.key,
      value: data.value,
      notes: data.notes,
    });

    if (result.success) {
      setAddingType(null);
    }
  };

  const handleRefresh = () => {
    refetch();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-5 w-48 mt-2" />
          </div>
          <Skeleton className="h-9 w-full sm:w-32" />
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <ErrorCard
          message="Failed to load holdings"
          error={error}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  // Get existing keys for duplicate validation
  const existingCryptoKeys = holdingsData?.crypto.map((h) => h.symbol) || [];
  const existingBankKeys = holdingsData?.bank_accounts.map((h) => h.key) || [];
  const existingOtherKeys = holdingsData?.other.map((h) => h.key) || [];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Holdings</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Manage manual holdings
            {holdingsData?.last_updated && (
              <span className="hidden sm:inline ml-2">
                · Last updated: {formatDate(holdingsData.last_updated)}
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isLoading} className="w-full sm:w-auto">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Prices
        </Button>
      </div>

      {/* Staleness Warning */}
      {freshnessData && freshnessData.is_stale && (
        <StalenessWarning
          daysOld={freshnessData.days_since_update}
        />
      )}

      {/* Cryptocurrency Table */}
      <CryptoTable
        holdings={holdingsData?.crypto || []}
        total={cryptoTotal}
        onEdit={handleEditCrypto}
        onDelete={handleDeleteCrypto}
        onAdd={() => setAddingType("crypto")}
      />

      {/* Bank Accounts Table */}
      <AccountTable
        title="Bank Accounts"
        category="bank"
        holdings={holdingsData?.bank_accounts || []}
        total={bankTotal}
        onEdit={(holding) => handleEditAccount("bank", holding)}
        onDelete={(key) => handleDeleteAccount("bank", key)}
        onAdd={() => setAddingType("bank")}
      />

      {/* Other Accounts Table */}
      <AccountTable
        title="Other Accounts"
        category="other"
        holdings={holdingsData?.other || []}
        total={otherTotal}
        onEdit={(holding) => handleEditAccount("other", holding)}
        onDelete={(key) => handleDeleteAccount("other", key)}
        onAdd={() => setAddingType("other")}
      />

      {/* Edit Dialog */}
      <HoldingEditDialog
        open={editingHolding !== null}
        onOpenChange={(open) => !open && setEditingHolding(null)}
        holding={editingHolding?.holding || null}
        type={editingHolding?.type || "crypto"}
        onSave={handleSaveEdit}
        isLoading={updateHolding.isPending}
      />

      {/* Add Dialogs */}
      <AddHoldingDialog
        open={addingType !== null}
        onOpenChange={(open) => !open && setAddingType(null)}
        type={addingType || "crypto"}
        existingKeys={
          addingType === "crypto"
            ? existingCryptoKeys
            : addingType === "bank"
              ? existingBankKeys
              : existingOtherKeys
        }
        onAdd={handleAdd}
        isLoading={updateHolding.isPending}
      />
    </div>
  );
}
