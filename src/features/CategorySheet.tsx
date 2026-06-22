import { useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { CategoryGlyph, ICON_PICKER_KEYS } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { useAppData } from "@/data/AppDataProvider";
import { useToast } from "@/components/Toast";
import type { Category } from "@/lib/types";

interface CategorySheetProps {
  open: boolean;
  onClose: () => void;
  editing?: Category | null;
}

export function CategorySheet({ open, onClose, editing }: CategorySheetProps) {
  const { addCategory, editCategory } = useAppData();
  const { show } = useToast();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("other");
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setIcon(editing?.icon ?? "other");
    setError(undefined);
  }, [open, editing]);

  const submit = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    try {
      if (editing) {
        await editCategory(editing.id, { name, icon });
        show("Category updated");
      } else {
        await addCategory({ name, icon });
        show("Category added");
      }
      onClose();
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not save category");
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? "Edit category" : "New category"}
      footer={
        <Button variant="primary" fullWidth onClick={submit}>
          {editing ? "Save changes" : "Add category"}
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <TextField
          label="Name"
          placeholder="e.g. Groceries"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
          autoFocus
        />
        <div className="flex flex-col gap-2">
          <span className="text-caption-strong text-ink-muted-80">Icon</span>
          <div className="grid grid-cols-6 gap-2">
            {ICON_PICKER_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setIcon(key)}
                className={cn(
                  "aspect-square rounded-md flex items-center justify-center outline-none",
                  icon === key
                    ? "border-2 border-primary-focus text-ink"
                    : "border border-hairline text-ink-muted-80",
                )}
              >
                <CategoryGlyph icon={key} size={22} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
