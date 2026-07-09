import type { ComponentType, ReactNode, SVGProps } from "react";

type EmptyStateProps = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-border/40 bg-background">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-normal">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
