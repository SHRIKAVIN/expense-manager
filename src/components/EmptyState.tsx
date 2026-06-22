import { type ReactNode } from "react";
import { Button } from "./Button";

interface EmptyStateProps {
  icon: ReactNode;
  headline: string;
  subcopy: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, headline, subcopy, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="text-primary mb-6">{icon}</div>
      <h2 className="text-lead text-ink mb-3 max-w-sm">{headline}</h2>
      <p className="text-body text-ink-muted-48 mb-6 max-w-sm">{subcopy}</p>
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
