"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { AccountHolding } from "@/lib/types";

interface AccountTableProps {
  title: string;
  category: "bank" | "other";
  holdings: AccountHolding[];
  total: number;
  onEdit: (holding: AccountHolding) => void;
  onDelete: (key: string) => void;
  onAdd: () => void;
}

export function AccountTable({
  title,
  category,
  holdings,
  total,
  onEdit,
  onDelete,
  onAdd,
}: AccountTableProps) {
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const handleDelete = (key: string) => {
    if (deletingKey === key) {
      // Confirm deletion
      onDelete(key);
      setDeletingKey(null);
    } else {
      // First click - set confirmation state
      setDeletingKey(key);
      // Auto-reset after 3 seconds
      setTimeout(() => setDeletingKey(null), 3000);
    }
  };

  const addButtonText = category === "bank" ? "+ Add Account" : "+ Add Account";

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <CardTitle>{title}</CardTitle>
          <span className="text-sm text-muted-foreground">
            Total: {formatCurrency(total)}
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={onAdd}>
          {addButtonText}
        </Button>
      </CardHeader>
      <CardContent>
        {holdings.length === 0 ? (
          <div className="rounded-lg border p-8 text-center text-muted-foreground">
            No {category === "bank" ? "bank accounts" : "accounts"}. Click
            &quot;Add Account&quot; to add one.
          </div>
        ) : (
          <>
            {/* Desktop table view */}
            <div className="hidden md:block border rounded-lg overflow-hidden">
              <div className="grid grid-cols-3 gap-4 p-4 border-b bg-muted/50 text-sm font-medium">
                <div>Account</div>
                <div>Balance</div>
                <div className="text-right">Actions</div>
              </div>
              {holdings.map((holding) => (
                <div
                  key={holding.key}
                  className="grid grid-cols-3 gap-4 p-4 border-b last:border-b-0 items-center"
                >
                  <div className="font-medium">{holding.name}</div>
                  <div className="text-green-600">
                    {formatCurrency(holding.balance)}
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
                        deletingKey === holding.key ? "destructive" : "ghost"
                      }
                      size="icon"
                      onClick={() => handleDelete(holding.key)}
                      title={
                        deletingKey === holding.key
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
                  key={holding.key}
                  className="rounded-lg border p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{holding.name}</span>
                    <span className="font-medium text-green-600">
                      {formatCurrency(holding.balance)}
                    </span>
                  </div>
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
                        deletingKey === holding.key ? "destructive" : "ghost"
                      }
                      size="sm"
                      onClick={() => handleDelete(holding.key)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      {deletingKey === holding.key ? "Confirm" : "Delete"}
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
