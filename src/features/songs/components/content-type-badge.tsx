import { Badge } from "@/components/ui/badge";

import { CONTENT_TYPE_LABELS, type ContentType } from "../domain/song";

export function ContentTypeBadge({ contentType }: { contentType: ContentType }) {
  return (
    <Badge variant={contentType === "external-link" ? "outline" : "secondary"}>
      {CONTENT_TYPE_LABELS[contentType]}
    </Badge>
  );
}
