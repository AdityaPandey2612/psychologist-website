"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import AdminGuard from "@/app/admin/AdminGuard";

/**
 * Page chrome shared by every /admin/assessments screen: the existing
 * AdminGuard (client-side Firebase sign-in check; the APIs re-verify the token
 * on the server), a back link, a title and a wide content area.
 */
export function AdminPage({
  eyebrow = "Assessments",
  title,
  description,
  back,
  actions,
  children,
  wide = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  back?: { href: string; label: string };
  actions?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <AdminGuard>
      {/* The root layout already provides the <main> landmark. */}
      <div className="min-h-screen bg-bg py-8 pl-4 pr-16 sm:pl-6 md:pl-10 md:pr-[4.5rem]">
        <div className={wide ? "mx-auto max-w-7xl" : "mx-auto max-w-5xl"}>
          {back && (
            <Link href={back.href} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-primary-dark hover:underline">
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              {back.label}
            </Link>
          )}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow">{eyebrow}</p>
              <h1 className="mt-2 text-3xl text-primary-dark sm:text-4xl">{title}</h1>
              {description && <p className="mt-3 max-w-2xl text-ink-soft">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
          </div>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </AdminGuard>
  );
}
