import Link from "next/link";

type IssueLinkProps = {
  issueId: string;
  label: string;
  muted?: boolean;
};

export function IssueLink({ issueId, label, muted = false }: IssueLinkProps) {
  return (
    <Link
      href={`/issue/${issueId}`}
      className={
        muted
          ? "text-muted-foreground hover:text-foreground hover:underline"
          : "font-medium text-foreground hover:underline"
      }
    >
      {label}
    </Link>
  );
}
