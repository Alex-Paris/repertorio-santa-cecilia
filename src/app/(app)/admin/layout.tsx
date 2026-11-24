import type { ReactNode } from "react";

import { AdminNavigation } from "@/components/layout/admin-navigation";

/** A autorização continua nas páginas e nas APIs; este layout organiza a navegação. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div data-layout="wide">
      <div className="admin-grid">
        <AdminNavigation />
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}
