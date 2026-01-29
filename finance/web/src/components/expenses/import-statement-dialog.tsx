"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

export function ImportStatementDialog() {
  return (
    <Button asChild>
      <Link href="/statements">
        <Upload className="h-4 w-4 mr-2" />
        Import Statement
      </Link>
    </Button>
  );
}
