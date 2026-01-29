"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import type { CCTransaction } from "@/lib/types";

interface TransactionTableProps {
  transactions: CCTransaction[] | undefined;
  isLoading: boolean;
}

export function TransactionTable({
  transactions,
  isLoading,
}: TransactionTableProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-full" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-2">Transactions</h3>
          <p className="text-sm text-muted-foreground">
            No transactions found. Import a credit card statement to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Get unique categories for filter
  const categories = Array.from(
    new Set(transactions.map((t) => t.category).filter(Boolean))
  ).sort() as string[];

  // Filter transactions
  const filtered = transactions.filter((t) => {
    const matchesSearch =
      !search ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.normalized_merchant.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || t.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h3 className="text-lg font-semibold">
            Transactions ({filtered.length})
          </h3>
          <div className="flex gap-2">
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="all">All categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Description</th>
                <th className="pb-2 pr-4">Category</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((txn) => (
                <tr key={txn.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">
                    {formatDate(txn.transaction_date)}
                  </td>
                  <td className="py-2 pr-4">
                    <span className="line-clamp-1">{txn.description}</span>
                  </td>
                  <td className="py-2 pr-4">
                    {txn.category ? (
                      <Badge variant="secondary" className="text-xs">
                        {txn.category}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">--</span>
                    )}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap font-medium">
                    {txn.type === "payment" ? (
                      <span className="text-green-600">
                        -{formatCurrency(txn.amount)}
                      </span>
                    ) : (
                      formatCurrency(txn.amount)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}
