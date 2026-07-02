import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";
import { AlertIcon, CloseIcon } from "@/lib/icons";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  /** "field" = rounded-md form field; "pill" = rounded-full (search). */
  shape?: "field" | "pill";
  leftAdornment?: ReactNode;
  rightAdornment?: ReactNode;
  /** Show a clear (×) control when the field has a value. */
  clearable?: boolean;
  onClear?: () => void;
}

const shellClass =
  "flex items-center gap-2 bg-surface-pearl border border-hairline transition-colors focus-within:ring-2 focus-within:ring-primary-focus";

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  {
    label,
    error,
    shape = "field",
    leftAdornment,
    rightAdornment,
    clearable,
    onClear,
    className,
    id,
    value,
    ...rest
  },
  ref,
) {
  const inputId = id ?? rest.name;
  const showClear =
    clearable && typeof value === "string" && value.length > 0 && !rest.disabled && !rest.readOnly;

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={inputId} className="text-caption-strong text-ink-muted-80">
          {label}
        </label>
      )}
      <div
        className={cn(
          shellClass,
          shape === "pill" ? "rounded-pill px-4 py-2.5" : "rounded-md px-3.5 py-2.5",
          className,
        )}
      >
        {leftAdornment && <span className="text-ink-muted-48 shrink-0">{leftAdornment}</span>}
        <input
          ref={ref}
          id={inputId}
          value={value}
          className="w-full bg-transparent outline-none text-body text-ink placeholder:text-ink-muted-48"
          {...rest}
        />
        {showClear && (
          <button
            type="button"
            aria-label="Clear"
            data-testid="search-clear"
            onClick={() => onClear?.()}
            className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-ink-muted-48 outline-none hover:text-ink"
          >
            <CloseIcon size={16} />
          </button>
        )}
        {rightAdornment && <span className="shrink-0">{rightAdornment}</span>}
      </div>
      {error && (
        <span className="flex items-center gap-1 text-caption text-ink-muted-48">
          <AlertIcon size={14} />
          {error}
        </span>
      )}
    </div>
  );
});

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, error, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={inputId} className="text-caption-strong text-ink-muted-80">
          {label}
        </label>
      )}
      <div
        className={cn(
          "rounded-md bg-surface-pearl border border-hairline px-3.5 py-2.5 transition-colors focus-within:ring-2 focus-within:ring-primary-focus",
          className,
        )}
      >
        <textarea
          ref={ref}
          id={inputId}
          className="w-full bg-transparent outline-none text-body text-ink placeholder:text-ink-muted-48 resize-none"
          {...rest}
        />
      </div>
      {error && (
        <span className="flex items-center gap-1 text-caption text-ink-muted-48">
          <AlertIcon size={14} />
          {error}
        </span>
      )}
    </div>
  );
});
