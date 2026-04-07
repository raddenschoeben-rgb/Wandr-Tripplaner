import { forwardRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

function formatWithCommas(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
}

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  value?: number | string;
  onChange?: (value: string) => void;
}

const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, className, ...props }, ref) => {
    const [display, setDisplay] = useState(() => {
      if (value === "" || value === undefined || value === null) return "";
      const num = Number(value);
      return isNaN(num) || num === 0 ? "" : num.toLocaleString("en-US");
    });

    useEffect(() => {
      if (value === "" || value === undefined || value === null) {
        setDisplay("");
        return;
      }
      const num = Number(value);
      if (!isNaN(num) && num > 0) {
        setDisplay(num.toLocaleString("en-US"));
      }
    }, [value]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value.replace(/\D/g, "");
      const formatted = raw ? Number(raw).toLocaleString("en-US") : "";
      setDisplay(formatted);
      onChange?.(raw);
    }

    return (
      <input
        {...props}
        ref={ref}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      />
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
