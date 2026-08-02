import type { ReactNode } from "react";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { cn } from "@/lib/utils";

type FormRowProps = {
  label: string;
  description?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
};

export function FormRow({ label, description, htmlFor, children, className }: FormRowProps) {
  return (
    <FieldGroup>
      <Field
        orientation="responsive"
        className={cn("@md/field-group:items-start @md/field-group:gap-8", className)}
      >
        <FieldContent className="min-w-0 @md/field-group:max-w-64">
          <FieldLabel htmlFor={htmlFor} className="text-xs">
            {label}
          </FieldLabel>
          {description ? (
            <FieldDescription className="text-xs">{description}</FieldDescription>
          ) : null}
        </FieldContent>
        <div className="min-w-0 @md/field-group:max-w-72">{children}</div>
      </Field>
    </FieldGroup>
  );
}
