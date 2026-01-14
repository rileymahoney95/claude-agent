"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { CryptoHolding } from "@/lib/types";

interface CryptoTableProps {
  holdings: CryptoHolding[];
  total: number;
  onEdit: (holding: CryptoHolding) => void;
  onDelete: (symbol: string) => void;
  onAdd: () => void;
}

export function CryptoTable({
  holdings,
  total,
  onEdit,
  onDelete,
  onAdd,
}: CryptoTableProps) {
  const [deletingSymbol, setDeletingSymbol] = useState<string | null>(null);

  const handleDelete = (symbol: string) => {
    if (deletingSymbol === symbol) {
      // Confirm deletion
      onDelete(symbol);
      setDeletingSymbol(null);
    } else {
      // First click - set confirmation state
      setDeletingSymbol(symbol);
      // Auto-reset after 3 seconds
      setTimeout(() => setDeletingSymbol(null), 3000);
    }
  };

  const formatQuantity = (quantity: number) => {
    // Format with up to 6 decimal places, trimming trailing zeros
    return quantity.toFixed(6).replace(/\.?0+$/, "");
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <CardTitle>Cryptocurrency</CardTitle>
          <span className="text-sm text-muted-foreground">
            Total: {formatCurrency(total)}
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={onAdd}>
          + Add Crypto
        </Button>
      </CardHeader>
      <CardContent>
        {holdings.length === 0 ? (
          <div className="rounded-lg border p-8 text-center text-muted-foreground">
            No crypto holdings. Click &quot;Add Crypto&quot; to add your first
            holding.
          </div>
        ) : (
          <>
            {/* Desktop table view */}
            <div className="hidden md:block border rounded-lg overflow-hidden">
              <div className="grid grid-cols-6 gap-4 p-4 border-b bg-muted/50 text-sm font-medium">
                <div>Symbol</div>
                <div>Quantity</div>
                <div>Price</div>
                <div>Value</div>
                <div>Notes</div>
                <div className="text-right">Actions</div>
              </div>
              {holdings.map((holding) => (
                <div
                  key={holding.symbol}
                  className="grid grid-cols-6 gap-4 p-4 border-b last:border-b-0 items-center"
                >
                  <div className="font-medium text-yellow-600">
                    {holding.symbol}
                  </div>
                  <div>{formatQuantity(holding.quantity)}</div>
                  <div>
                    {holding.price !== null
                      ? formatCurrency(holding.price)
                      : "N/A"}
                  </div>
                  <div className="text-green-600">
                    {holding.value !== null
                      ? formatCurrency(holding.value)
                      : "N/A"}
                  </div>
                  <div className="text-muted-foreground truncate">
                    {holding.notes || "—"}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(holding)}
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={
                        deletingSymbol === holding.symbol
                          ? "destructive"
                          : "ghost"
                      }
                      size="icon"
                      onClick={() => handleDelete(holding.symbol)}
                      title={
                        deletingSymbol === holding.symbol
                          ? "Click again to confirm"
                          : "Delete"
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile card view */}
            <div className="md:hidden space-y-3">
              {holdings.map((holding) => (
                <div
                  key={holding.symbol}
                  className="rounded-lg border p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-yellow-600">
                      {holding.symbol}
                    </span>
                    <span className="font-medium text-green-600">
                      {holding.value !== null
                        ? formatCurrency(holding.value)
                        : "N/A"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Qty: </span>
                      {formatQuantity(holding.quantity)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Price: </span>
                      {holding.price !== null
                        ? formatCurrency(holding.price)
                        : "N/A"}
                    </div>
                  </div>
                  {holding.notes && (
                    <p className="text-sm text-muted-foreground truncate">
                      {holding.notes}
                    </p>
                  )}
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(holding)}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant={
                        deletingSymbol === holding.symbol
                          ? "destructive"
                          : "ghost"
                      }
                      size="sm"
                      onClick={() => handleDelete(holding.symbol)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      {deletingSymbol === holding.symbol ? "Confirm" : "Delete"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
