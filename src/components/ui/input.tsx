import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        suppressHydrationWarning
        className={cn(
          "h-9 w-full rounded-sm bg-bg px-2.5 text-sm text-fg shadow-border placeholder:text-subtle outline-none transition-[box-shadow] duration-150 focus-visible:shadow-[0_0_0_1px_var(--color-primary)]",
          className,
        )}
        {...props}
      />
    );
  },
);
