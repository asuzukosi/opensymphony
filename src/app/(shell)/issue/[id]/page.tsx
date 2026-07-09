import { IssuePageClient } from "./issue-page-client";

export function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function IssuePage() {
  return <IssuePageClient />;
}
