import type { Express, NextFunction, Request, Response } from "express";
import { type Server } from "http";
import path from "path";
import { z } from "zod";
import puppeteer from "puppeteer-core";
import { storage, consumeInitialAdminPassword } from "./storage";
import {
  changePasswordSchema,
  insertFormSettingsSchema,
  insertMemberSchema,
  insertSubscriptionSchema,
  insertUserSchema,
  updateMemberSchema,
  updateUserSchema,
} from "@shared/schema";
import { t, getLang } from "./i18n";

// ── Value normalizers: accept translated (Arabic/English) OR raw enum values ─
function normalizeGender(v: unknown): unknown {
  const s = String(v ?? "").trim().toLowerCase();
  const map: Record<string, string> = {
    male: "male", ذكر: "male", م: "male",
    female: "female", "أنثى": "female", "انثى": "female", "أنثي": "female", f: "female",
  };
  return map[s] ?? v;
}
function normalizeMembershipType(v: unknown): unknown {
  const s = String(v ?? "").trim().toLowerCase();
  const map: Record<string, string> = {
    original: "original", "أصيل": "original", "اصيل": "original",
    associate: "associate", "مشارك": "associate",
  };
  return map[s] ?? v;
}
function normalizeSpecialty(v: unknown): unknown {
  const s = String(v ?? "").trim().toLowerCase();
  const map: Record<string, string> = {
    cardiology: "cardiology", "قلبية داخلية": "cardiology", "قلبية": "cardiology", cardiac: "cardiology",
    cardiac_surgery: "cardiac_surgery", "cardiac surgery": "cardiac_surgery",
    "جراحة قلب": "cardiac_surgery", "جراحة القلب": "cardiac_surgery",
  };
  return map[s] ?? v;
}
function normalizeMemberRow(row: Record<string, unknown>): Record<string, unknown> {
  const r = { ...row };
  if (r.gender      != null) r.gender       = normalizeGender(r.gender);
  if (r.membershipType != null) r.membershipType = normalizeMembershipType(r.membershipType);
  if (r.specialty   != null) r.specialty    = normalizeSpecialty(r.specialty);
  return r;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

function paramId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : (id as string);
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}

function handleZodError(req: Request, res: Response, error: z.ZodError) {
  return res
    .status(400)
    .json({ message: t(req, "invalidData"), errors: error.flatten().fieldErrors });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // ---------- One-time reveal of the freshly generated admin password ----------
  // On the very first boot of the application, the storage layer creates an
  // `admin` user with a strong random password. This endpoint lets the login
  // page surface that password ONCE so the operator does not have to dig
  // through the server logs. After the first successful read the value is
  // dropped from memory and a 404 is returned forever after.
  app.get("/api/initial-credentials", (_req, res) => {
    const password = consumeInitialAdminPassword();
    if (!password) {
      return res.status(404).json({ message: "Not available" });
    }
    res.json({ username: "admin", password });
  });

  // ---------- Users (admin only) ----------
  app.get("/api/users", requireAdmin, async (_req, res, next) => {
    try {
      const users = await storage.getUsers();
      res.json(users.map(({ password, ...rest }) => rest));
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/users", requireAdmin, async (req, res, next) => {
    const parsed = insertUserSchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(req, res, parsed.error);
    try {
      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.default.hash(parsed.data.password, 10);
      const user = await storage.createUser({
        username: parsed.data.username,
        password: hashedPassword,
        role: parsed.data.role ?? "employee",
      });
      const { password, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (err: any) {
      if (err?.code === "23505") {
        return res.status(409).json({ message: t(req, "usernameTaken") });
      }
      next(err);
    }
  });

  app.patch("/api/users/:id", requireAdmin, async (req, res, next) => {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(req, res, parsed.error);
    try {
      const updates: Record<string, unknown> = { ...parsed.data };

      // Last-admin protection: refuse to demote the only remaining admin.
      if (typeof updates.role === "string" && updates.role !== "admin") {
        const target = await storage.getUser(paramId(req));
        if (target?.role === "admin") {
          const remaining = await storage.countOtherAdmins(target.id);
          if (remaining === 0) {
            return res.status(409).json({
              message: t(req, "cantDemoteLastAdmin"),
            });
          }
        }
      }

      if (typeof updates.password === "string") {
        const bcrypt = await import("bcryptjs");
        updates.password = await bcrypt.default.hash(updates.password, 10);
      }
      const user = await storage.updateUser(paramId(req), updates as any);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res, next) => {
    try {
      const targetId = paramId(req);
      if (req.user?.id === targetId) {
        return res
          .status(400)
          .json({ message: t(req, "cantDeleteSelf") });
      }

      // Last-admin protection: refuse to delete the only remaining admin.
      const target = await storage.getUser(targetId);
      if (target?.role === "admin") {
        const remaining = await storage.countOtherAdmins(targetId);
        if (remaining === 0) {
          return res.status(409).json({
            message: t(req, "cantDeleteLastAdmin"),
          });
        }
      }

      await storage.deleteUser(targetId);
      res.sendStatus(204);
    } catch (err) {
      next(err);
    }
  });

  // ---------- Members ----------
  app.get("/api/members", requireAuth, async (_req, res, next) => {
    try {
      const members = await storage.getMembers();
      const subsMap = await storage.getSubscriptionsByMemberIds(
        members.map((m) => m.id),
      );
      const membersWithSubs = members.map((member) => ({
        ...member,
        subscriptions: subsMap.get(member.id) ?? [],
      }));
      res.json(membersWithSubs);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/members/:id", requireAuth, async (req, res, next) => {
    try {
      const member = await storage.getMember(paramId(req));
      if (!member) return res.status(404).json({ message: "Member not found" });
      const subs = await storage.getSubscriptionsByMemberId(member.id);
      res.json({ ...member, subscriptions: subs });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/members", requireAuth, async (req, res, next) => {
    const parsed = insertMemberSchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(req, res, parsed.error);
    try {
      const member = await storage.createMember(parsed.data);
      res.status(201).json(member);
    } catch (err) {
      next(err);
    }
  });

  app.patch("/api/members/:id", requireAuth, async (req, res, next) => {
    const parsed = updateMemberSchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(req, res, parsed.error);
    try {
      const member = await storage.updateMember(paramId(req), parsed.data);
      if (!member) return res.status(404).json({ message: "Member not found" });
      res.json(member);
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/members/:id", requireAuth, async (req, res, next) => {
    try {
      await storage.deleteMember(paramId(req));
      res.sendStatus(204);
    } catch (err) {
      next(err);
    }
  });

  app.post(
    "/api/members/:id/subscriptions",
    requireAuth,
    async (req, res, next) => {
      const parsed = insertSubscriptionSchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(req, res, parsed.error);
      try {
        const member = await storage.getMember(paramId(req));
        if (!member) {
          return res.status(404).json({ message: "Member not found" });
        }
        const sub = await storage.createSubscription({
          ...parsed.data,
          memberId: paramId(req),
        });
        res.status(201).json(sub);
      } catch (err) {
        next(err);
      }
    },
  );

  app.patch("/api/subscriptions/:id", requireAuth, async (req, res, next) => {
    const parsed = insertSubscriptionSchema.partial().safeParse(req.body);
    if (!parsed.success) return handleZodError(req, res, parsed.error);
    try {
      const existing = await storage.getSubscription(paramId(req));
      if (!existing) {
        return res.status(404).json({ message: "Subscription not found" });
      }
      const updated = await storage.updateSubscription(paramId(req), parsed.data);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/subscriptions/:id", requireAuth, async (req, res, next) => {
    try {
      const existing = await storage.getSubscription(paramId(req));
      if (!existing) {
        return res.status(404).json({ message: "Subscription not found" });
      }
      await storage.deleteSubscription(paramId(req));
      res.sendStatus(204);
    } catch (err) {
      next(err);
    }
  });

  // ---------- Change Password (forced on first login) ----------
  app.post("/api/user/change-password", requireAuth, async (req, res, next) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(req, res, parsed.error);
    try {
      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.default.hash(parsed.data.newPassword, 10);
      const updated = await storage.updateUser(req.user!.id, {
        password: hashedPassword,
        mustChangePassword: false,
      });
      if (!updated) return res.status(404).json({ message: "User not found" });
      const { password, ...safeUser } = updated;
      res.json(safeUser);
    } catch (err) {
      next(err);
    }
  });

  // ---------- Subscriptions Bulk Import ----------
  app.post("/api/subscriptions/import", requireAuth, async (req, res, next) => {
    try {
      const body = req.body;
      const rows = Array.isArray(body) ? body : body?.rows;
      const updateExisting = !Array.isArray(body) && body?.updateExisting === true;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: t(req, "noImportRows") });
      }

      // Load all members once for lookup
      const allMembers = await storage.getMembers();
      const byNumber = new Map<number, typeof allMembers[0]>();
      const byName = new Map<string, typeof allMembers[0]>();
      for (const m of allMembers) {
        if (m.membershipNumber) byNumber.set(m.membershipNumber, m);
        const nameKey = `${(m.firstName || "").trim()}_${(m.lastName || "").trim()}`.toLowerCase();
        byName.set(nameKey, m);
      }

      // Cache existing (memberId, year) -> subscription id, to skip or update.
      // Single batched query instead of N queries (one per member).
      const existingByPair = new Map<string, string>();
      const subsMap = await storage.getSubscriptionsByMemberIds(
        allMembers.map((m) => m.id),
      );
      subsMap.forEach((subs, memberId) => {
        for (const s of subs) existingByPair.set(`${memberId}:${s.year}`, s.id);
      });

      const results = {
        success: 0,
        updated: 0,
        failed: 0,
        skipped: 0,
        errors: [] as string[],
      };

      for (const row of rows) {
        const rowLabel = `(${row.firstName || ""} ${row.lastName || ""} - ${row.year || ""})`;

        // Resolve member
        let member: typeof allMembers[0] | undefined;
        if (row.membershipNumber) {
          member = byNumber.get(Number(row.membershipNumber));
        }
        if (!member && row.firstName && row.lastName) {
          const key = `${String(row.firstName).trim()}_${String(row.lastName).trim()}`.toLowerCase();
          member = byName.get(key);
        }
        if (!member) {
          results.failed++;
          results.errors.push(`${rowLabel}: ${t(req, "memberNotFound")}`);
          continue;
        }

        // Validate subscription fields
        const parsed = insertSubscriptionSchema.safeParse({
          year: row.year,
          amount: row.amount,
          date: row.date,
          notes: row.notes || null,
        });
        if (!parsed.success) {
          results.failed++;
          results.errors.push(`${rowLabel}: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
          continue;
        }

        const pairKey = `${member.id}:${parsed.data.year}`;
        const existingId = existingByPair.get(pairKey);

        if (existingId) {
          if (!updateExisting) {
            results.skipped++;
            continue;
          }
          try {
            await storage.updateSubscription(existingId, parsed.data);
            results.updated++;
          } catch {
            results.failed++;
            results.errors.push(`${rowLabel}: ${t(req, "subUpdateFailed")}`);
          }
          continue;
        }

        try {
          const created = await storage.createSubscription({
            ...parsed.data,
            memberId: member.id,
          });
          existingByPair.set(pairKey, created.id);
          results.success++;
        } catch {
          results.failed++;
          results.errors.push(`${rowLabel}: ${t(req, "dbSaveFailed")}`);
        }
      }

      res.json(results);
    } catch (err) {
      next(err);
    }
  });

  // ---------- Members Bulk Import ----------
  app.post("/api/members/import", requireAuth, async (req, res, next) => {
    try {
      const body = req.body;
      const rows = Array.isArray(body) ? body : body?.rows;
      const updateExisting = !Array.isArray(body) && body?.updateExisting === true;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: t(req, "noImportRows") });
      }

      // Build a name -> existing member lookup
      const existing = await storage.getMembers();
      const existingByName = new Map<string, typeof existing[0]>();
      for (const m of existing) {
        const key = `${(m.firstName || "").trim()}_${(m.lastName || "").trim()}`.toLowerCase();
        existingByName.set(key, m);
      }

      const results = {
        success: 0,
        updated: 0,
        failed: 0,
        skipped: 0,
        errors: [] as string[],
      };
      for (const row of rows) {
        const parsed = insertMemberSchema.safeParse(normalizeMemberRow(row as Record<string, unknown>));
        if (!parsed.success) {
          results.failed++;
          results.errors.push(
            `${t(req, "rowPrefix")} (${row.firstName || "?"} ${row.lastName || "?"}): ${JSON.stringify(parsed.error.flatten().fieldErrors)}`
          );
          continue;
        }

        const nameKey = `${(parsed.data.firstName || "").trim()}_${(parsed.data.lastName || "").trim()}`.toLowerCase();
        const existingMember = existingByName.get(nameKey);

        if (existingMember) {
          if (!updateExisting) {
            results.skipped++;
            continue;
          }
          try {
            await storage.updateMember(existingMember.id, parsed.data);
            results.updated++;
          } catch {
            results.failed++;
            results.errors.push(`${t(req, "failUpdate")}: ${row.firstName || ""} ${row.lastName || ""}`);
          }
          continue;
        }

        try {
          const created = await storage.createMember(parsed.data);
          existingByName.set(nameKey, created);
          results.success++;
        } catch {
          results.failed++;
          results.errors.push(`${t(req, "failSave")}: ${row.firstName || ""} ${row.lastName || ""}`);
        }
      }
      res.json(results);
    } catch (err) {
      next(err);
    }
  });

  // ---------- Subscriptions Excel Export ----------
  app.get("/api/subscriptions/export", requireAuth, async (_req, res, next) => {
    try {
      const members = await storage.getMembers();
      const subsMap = await storage.getSubscriptionsByMemberIds(members.map((m) => m.id));
      const rows: object[] = [];
      for (const m of members) {
        const subs = subsMap.get(m.id) ?? [];
        for (const s of subs) {
          rows.push({
            membershipNumber: m.membershipNumber,
            firstName: m.firstName,
            lastName: m.lastName,
            year: s.year,
            amount: s.amount,
            date: s.date,
            notes: s.notes ?? "",
          });
        }
      }
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  // ---------- Backup & Restore ----------
  app.get("/api/backup", requireAdmin, async (_req, res, next) => {
    try {
      const members = await storage.getMembers();
      const subsMap = await storage.getSubscriptionsByMemberIds(
        members.map((m) => m.id),
      );
      const allSubscriptions = Array.from(subsMap.values()).flat();
      const users = await storage.getUsers();
      const backup = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        data: {
          members,
          subscriptions: allSubscriptions,
          users: users.map(({ password, ...rest }) => rest),
        },
      };
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="scva-backup-${new Date().toISOString().split("T")[0]}.json"`
      );
      res.json(backup);
    } catch (err) {
      next(err);
    }
  });

  // ---------- Member PDF ----------
  // Renders the member's report page using a headless Chromium and returns a PDF.
  //
  // Production notes (kept here so future maintainers don't repeat earlier mistakes):
  //   • The browser fetches the page through the *local* Express server using
  //     127.0.0.1 — never the public proxy domain. This keeps things fast,
  //     avoids any reverse-proxy hops, and prevents auth round-tripping.
  //   • We forward the user's session by injecting the raw `Cookie` header on
  //     every browser request via `setExtraHTTPHeaders`, instead of fabricating
  //     cookie objects bound to "localhost". The previous approach silently
  //     failed behind any TLS/Domain-aware proxy.
  //   • If Chromium is missing on the host (common in stripped-down deploys),
  //     we surface a Bilingual 503 telling the user to use the Word export
  //     instead — never a raw stack trace.
  app.get("/api/members/:id/pdf", requireAuth, async (req, res) => {
    let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
    try {
      const member = await storage.getMember(paramId(req));
      if (!member) return res.status(404).json({ message: "Member not found" });

      const { execSync } = await import("child_process");
      let chromePath = process.env.CHROME_PATH;
      if (!chromePath) {
        try {
          chromePath = execSync("which chromium", { encoding: "utf8" }).trim();
        } catch {
          chromePath = "/usr/bin/chromium";
        }
      }

      browser = await puppeteer.launch({
        executablePath: chromePath,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
        ],
      });

      const page = await browser.newPage();

      // Forward the caller's session cookie verbatim — works on any host/scheme.
      if (req.headers.cookie) {
        await page.setExtraHTTPHeaders({ Cookie: req.headers.cookie });
      }

      const fs = await import("fs");
      const path = await import("path");

      // Resolve the logo from the project root. Using `process.cwd()` works
      // in both dev (tsx) and production (bundled CJS, where `import.meta.url`
      // is undefined). If the file is missing, fall back to a logo-less header
      // instead of crashing the whole PDF request.
      const logoPath = path.resolve(
        process.cwd(),
        "client/src/assets/logo.base64.txt",
      );
      let logoBase64 = "";
      try {
        const logoBase64Content = fs.readFileSync(logoPath, "utf8").trim();
        logoBase64 = `data:image/jpeg;base64,${logoBase64Content}`;
      } catch (logoErr) {
        console.warn(
          "[PDF] logo file not found, generating PDF without it:",
          (logoErr as Error)?.message,
        );
      }

      // Honour the caller's UI language so the rendered page matches it.
      const langParam = (req.query.lang === "en" ? "en" : "ar") as "ar" | "en";

      // Always go through the loopback interface — bypasses any reverse proxy.
      const port = process.env.PORT || "5000";
      const memberUrl = `http://127.0.0.1:${port}/member/${paramId(req)}?print=true&lang=${langParam}`;

      await page.goto(memberUrl, { waitUntil: "networkidle0" });

      const headerTitle =
        langParam === "en"
          ? "Syrian Cardiovascular Association"
          : "الرابطة السورية لأمراض وجراحة القلب";
      const headerSubtitle =
        langParam === "en"
          ? "الرابطة السورية لأمراض وجراحة القلب"
          : "Syrian Cardiovascular Association";

      await page.evaluate(
        (logo: string, title: string, subtitle: string) => {
          // ---- Force light theme regardless of the user's UI preference ----
          // The app defaults to a dark theme, which produces a near-black
          // hero gradient and translucent white pills designed for that
          // background. For PDF export we always want a clean, paper-like
          // light layout, so we strip the `dark` class and switch the
          // browser color-scheme hint to light.
          document.documentElement.classList.remove("dark");
          document.documentElement.style.colorScheme = "light";

          const style = document.createElement("style");
          style.textContent = `
            /* Hide Replit overlay/banner */
            #replit-dev-banner, .replit-watermark,
            [class*="replit"], [id*="replit"] {
              display: none !important;
            }

            /* Print backgrounds reliably */
            * { -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important; }

            /* ---- Page surface: clean white, dark text ---- */
            html, body {
              background: #ffffff !important;
              color: #0f172a !important;
            }

            /* ---- Hero card: kill the dark gradient, replace with a
               professional light brand-bar (subtle teal accent) ---- */
            .bg-brand-gradient {
              background: linear-gradient(135deg, #f8fafc 0%, #eef6fa 100%) !important;
              color: #0f172a !important;
              border-bottom: 3px solid #096B8F !important;
              box-shadow: none !important;
            }
            .bg-brand-gradient * {
              color: #0f172a !important;
              text-shadow: none !important;
              filter: none !important;
            }
            .bg-brand-gradient h1 {
              color: #064a64 !important;
              font-weight: 800 !important;
            }
            .bg-brand-gradient p {
              color: #334155 !important;
            }
            /* Hide the decorative grid overlay used in the UI */
            .bg-grid-soft { display: none !important; }

            /* ---- Pills inside the hero (membership type, #, date, city) ----
               They were translucent white over a dark gradient. Repaint them
               as light cards with a soft border and dark text. */
            .bg-brand-gradient [class*="bg-white\\/"],
            .bg-brand-gradient .bg-white\\/15,
            .bg-brand-gradient .bg-white\\/20 {
              background: #ffffff !important;
              color: #0f172a !important;
              border: 1px solid #cbd5e1 !important;
              box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05) !important;
              backdrop-filter: none !important;
            }

            /* ---- Generic card surfaces: ensure they stay light ---- */
            [class*="bg-card"], .bg-card {
              background: #ffffff !important;
              color: #0f172a !important;
            }
            [class*="text-muted-foreground"] {
              color: #475569 !important;
            }
            [class*="text-foreground"] {
              color: #0f172a !important;
            }

            /* ---- Section accent bars (the small primary stripe in CardTitle) */
            .bg-primary { background-color: #096B8F !important; }

            /* ---- Hide controls that don't belong in the PDF ---- */
            .print\\:hidden, [data-print="hide"] { display: none !important; }

            /* ---- PDF header (logo + association name strip) ---- */
            .pdf-header {
              display: flex !important;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 24px;
              padding-bottom: 16px;
              border-bottom: 2px solid #e2e8f0;
            }
            .pdf-logo { width: 72px; height: 72px; object-fit: contain; }
            .pdf-title { text-align: center; flex-grow: 1; }
            .pdf-title h2 { color: #064a64 !important; margin: 0; font-weight: 800; }
            .pdf-title p { color: #475569 !important; margin: 4px 0 0 0; font-size: 13px; }

            /* Page-break protection for important blocks */
            .pdf-no-break, h1, h2, h3 { break-inside: avoid; page-break-inside: avoid; }
          `;
          document.head.appendChild(style);

          const header = document.createElement("div");
          header.className = "pdf-header pdf-no-break";
          header.innerHTML = `
            <img src="${logo}" class="pdf-logo" alt="" />
            <div class="pdf-title">
              <h2>${title}</h2>
              <p>${subtitle}</p>
            </div>
            <div style="width: 72px;"></div>
          `;

          const content = document.getElementById("member-report-content");
          if (content) content.insertBefore(header, content.firstChild);
        },
        logoBase64,
        headerTitle,
        headerSubtitle,
      );

      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" },
      });

      res.contentType("application/pdf");
      res.send(pdf);
    } catch (error: any) {
      console.error("PDF Generation Error:", error);
      const msg = error?.message ?? String(error);
      // Recognise the "Chromium is not installed" family of errors and turn
      // them into a friendly 503 with an explicit fallback for the user.
      const chromiumMissing =
        /ENOENT|Failed to launch the browser process|spawn .* ENOENT|Could not find Chromium|Browser was not found|executablePath/i.test(
          msg,
        );
      if (chromiumMissing) {
        return res.status(503).json({
          message: t(req, "pdfNotAvailable"),
        });
      }
      res.status(500).json({
        message: t(req, "pdfGenerationFailed"),
        error: msg,
      });
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  });

  // ---------- Admin: Test AI API key ----------
  app.post("/api/admin/test-ai", requireAdmin, async (req, res, next) => {
    try {
      const { provider, apiKey } = req.body as { provider?: string; apiKey?: string };
      if (!provider || !apiKey || !apiKey.trim()) {
        return res.status(400).json({ success: false, message: "المزود والمفتاح مطلوبان" });
      }
      const prompt = "قل جملة واحدة قصيرة تُؤكد أن مفتاح الـ API يعمل بشكل صحيح.";
      let reply = "";
      if (provider === "gemini") {
        // جرّب النماذج بالترتيب حتى ينجح أحدها
        const geminiModels = [
          "gemini-2.5-flash-preview-04-17",
          "gemini-2.5-flash",
          "gemini-2.0-flash-001",
          "gemini-1.5-flash",
        ];
        let lastErrMsg = "";
        let succeeded = false;
        let usedModel = "";
        for (const model of geminiModels) {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
          const resp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          });
          if (resp.ok) {
            const json = (await resp.json()) as Record<string, any>;
            reply = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
            usedModel = model;
            succeeded = true;
            break;
          }
          const errData = (await resp.json().catch(() => ({}))) as Record<string, any>;
          lastErrMsg = errData?.error?.message || `HTTP ${resp.status}`;
          // إن كان الخطأ "نموذج غير متاح" جرّب التالي، وإلا توقّف (مفتاح خاطئ، حصة منتهية...)
          const isModelUnavailable =
            resp.status === 404 ||
            /no longer available|not found|not supported/i.test(lastErrMsg);
          if (!isModelUnavailable) break;
        }
        if (!succeeded) {
          return res.json({ success: false, message: lastErrMsg || "لا يوجد نموذج Gemini متاح لهذا المفتاح." });
        }
        const modelLabel = usedModel.includes("2.5") ? "Gemini 2.5 Flash" : usedModel.includes("2.0") ? "Gemini 2.0 Flash" : "Gemini 1.5 Flash";
        return res.json({ success: true, message: `${reply || "✅ المفتاح يعمل"} — (${modelLabel})` });
      } else {
        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey.trim()}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 60,
          }),
        });
        if (!resp.ok) {
          const err = (await resp.json().catch(() => ({}))) as Record<string, any>;
          return res.json({ success: false, message: err?.error?.message || `HTTP ${resp.status}` });
        }
        const json = (await resp.json()) as Record<string, any>;
        reply = json?.choices?.[0]?.message?.content?.trim() || "";
      }
      res.json({ success: true, message: reply || "المفتاح يعمل بشكل صحيح ✅" });
    } catch (err) {
      next(err);
    }
  });

  // ---------- Admin: test Telegram bot ----------
  app.post("/api/admin/test-telegram", requireAdmin, async (req, res, next) => {
    try {
      const { botToken, chatId } = req.body as { botToken?: string; chatId?: string };
      if (!botToken?.trim() || !chatId?.trim()) {
        return res.status(400).json({ success: false, message: "التوكن ومعرّف المحادثة مطلوبان" });
      }
      const testText =
        "✅ اختبار بوت SCVA\n\nالبوت يعمل بشكل صحيح!\nالرابطة السورية لأمراض وجراحة القلب 🏥\n\n" +
        "⏰ " + new Date().toLocaleString("ar-SY", { timeZone: "Asia/Damascus" });
      const tgRes = await fetch(
        `https://api.telegram.org/bot${botToken.trim()}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId.trim(), text: testText }),
        }
      );
      const result = (await tgRes.json()) as { ok: boolean; description?: string };
      if (result.ok) {
        return res.json({ success: true, message: "✅ تم إرسال رسالة الاختبار بنجاح!" });
      }
      return res.json({ success: false, message: result.description || "خطأ من Telegram API" });
    } catch (err) {
      next(err);
    }
  });

  // ---------- Form Settings (admin only) ----------
  app.get("/api/form-settings", requireAdmin, async (_req, res, next) => {
    try {
      const settings = await storage.getFormSettings();
      res.json(settings);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/form-settings", requireAdmin, async (req, res, next) => {
    const parsed = insertFormSettingsSchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(req, res, parsed.error);
    try {
      const updated = await storage.updateFormSettings(parsed.data);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // ---------- Admin: download n8n workflow with injected settings ----------
  app.get("/api/admin/workflow", requireAdmin, async (req, res, next) => {
    try {
      const settings = await storage.getFormSettings();
      const proto = req.get("x-forwarded-proto") || req.protocol || "https";
      const host = req.get("x-forwarded-host") || req.get("host") || "";
      const appUrl = host ? `${proto}://${host}` : "";

      const workflowPath = path.resolve(
        process.cwd(),
        "docs/form_by_n8n/workflow/scva-member-workflow.json",
      );

      const { readFileSync } = await import("fs");
      const raw = readFileSync(workflowPath, "utf-8");
      const workflow = JSON.parse(raw);

      // ── Inject all available settings into the workflow before download ──

      const adminEmail = settings.notificationEmail || "";
      const verificationCode = settings.verificationCode || "SCVA-2026";

      for (const node of workflow.nodes) {
        // 1. Verify Invitation Code — hardcode the actual code into jsCode
        if (node.id === "verify-code" && node.parameters?.jsCode) {
          node.parameters.jsCode = node.parameters.jsCode.replace(
            /\/\/ ── Read from n8n Variables[\s\S]*?\/\/ \$vars not available — using default fallback\n\}/,
            `// ── Verification code injected from SCVA app settings:\nconst expectedCode = '${verificationCode.trim().toUpperCase()}';`
          );
        }

        // 2. Admin email node — inject toEmail + fromEmail
        if (node.id === "email-admin" && node.parameters) {
          if (adminEmail) {
            node.parameters.toEmail = adminEmail;
            node.parameters.fromEmail = adminEmail;
          }
        }

        // 3. Member confirmation email node — inject fromEmail
        if (node.id === "email-member" && node.parameters) {
          if (adminEmail) {
            node.parameters.fromEmail = adminEmail;
          }
        }

        // 4. AI node — inject provider and API key as literal constants
        if (node.id === "build-ai-prompt" && node.parameters?.jsCode) {
          const aiProvider = settings.aiProvider || "openai";
          const aiApiKey = settings.aiApiKey || "";
          node.parameters.jsCode = node.parameters.jsCode
            .replace("'__SCVA_AI_PROVIDER__'", `'${aiProvider}'`)
            .replace("'__SCVA_AI_KEY__'", `'${aiApiKey}'`);
        }

        // 5. Telegram node — inject bot token and chat ID
        if (node.id === "telegram-notify" && node.parameters?.jsCode) {
          const tgToken = settings.telegramBotToken || "";
          const tgChatId = settings.telegramChatId || "";
          node.parameters.jsCode = node.parameters.jsCode
            .replace("'__SCVA_TELEGRAM_TOKEN__'", `'${tgToken}'`)
            .replace("'__SCVA_TELEGRAM_CHAT_ID__'", `'${tgChatId}'`);
        }

        // 6. HTTP append node — inject app URL with API key as query param
        if (node.id === "append-excel-http" && node.parameters) {
          if (appUrl && settings.apiKey) {
            node.parameters.url = `${appUrl}/api/public/append-excel?key=${settings.apiKey}`;
          } else if (appUrl) {
            node.parameters.url = `${appUrl}/api/public/append-excel`;
          }
          // Also inject into Authorization header as fallback
          if (node.parameters.headerParameters?.parameters) {
            for (const h of node.parameters.headerParameters.parameters) {
              if (h.name === "Authorization") {
                h.value = `Bearer ${settings.apiKey}`;
              }
            }
          }
        }
      }

      // Embed summary in __meta for reference
      if (workflow.__meta) {
        workflow.__meta.injectedSettings = {
          adminEmail: adminEmail || "(not set)",
          verificationCode: verificationCode,
          apiKey: settings.apiKey ? "✅ مُضمَّن" : "(not set)",
          aiProvider: settings.aiProvider || "openai",
          aiEnabled: settings.aiApiKey ? "✅ مفعَّل" : "❌ غير مُفعَّل",
          telegramEnabled: settings.telegramBotToken && settings.telegramChatId ? "✅ مفعَّل" : "❌ غير مُفعَّل",
          appUrl: appUrl || "(not set)",
          note: "Only SMTP credentials need to be set manually in n8n.",
        };
      }

      res
        .setHeader("Content-Type", "application/json")
        .setHeader(
          "Content-Disposition",
          'attachment; filename="scva-member-workflow.json"',
        )
        .json(workflow);
    } catch (err) {
      next(err);
    }
  });

  // ---------- Public: serve the external member registration form ----------
  app.get("/form", (_req, res) => {
    const formPath = path.resolve(process.cwd(), "docs/form_by_n8n/member-form.html");
    res.sendFile(formPath);
  });

  // ---------- Public: form configuration for external form ----------
  app.get("/api/public/form-config", async (_req, res, next) => {
    try {
      const settings = await storage.getFormSettings();
      res.json({ webhookUrl: settings.webhookUrl });
    } catch (err) {
      next(err);
    }
  });

  // ---------- Public: verify invitation code (no auth) ----------
  app.get("/api/public/verify-code", async (req, res, next) => {
    try {
      const code = String(req.query.code ?? "").trim();
      if (!code) {
        return res.status(400).json({ valid: false, message: "رمز التحقق مطلوب" });
      }
      const settings = await storage.getFormSettings();
      const valid = code === settings.verificationCode;
      res.json({ valid });
    } catch (err) {
      next(err);
    }
  });

  // ---------- Public: append member row to Excel file (called by n8n) ----------
  // Authentication: Bearer token (Authorization header) OR ?key= query param
  app.post("/api/public/append-excel", async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization ?? "";
      const tokenFromHeader = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
      const tokenFromQuery = String(req.query.key ?? "").trim();
      const token = tokenFromHeader || tokenFromQuery;
      const settings = await storage.getFormSettings();

      if (!token || token !== settings.apiKey) {
        return res.status(401).json({ success: false, message: "Unauthorized: invalid API key" });
      }

      const data = req.body as Record<string, unknown>;

      const XLSX = await import("xlsx");
      const fsModule = await import("fs");
      const pathModule = await import("path");

      const excelDir = pathModule.resolve(process.cwd(), "docs/form_by_n8n");
      const clean = (v: unknown) => (v != null ? String(v).trim() : "");

      // ── Translation maps — ensures both files always get correct labels ──
      const AR_GENDER:     Record<string, string> = { male: "ذكر",              female: "أنثى" };
      const AR_SPECIALTY:  Record<string, string> = { cardiology: "قلبية داخلية", cardiac_surgery: "جراحة قلب" };
      const AR_MEMBERSHIP: Record<string, string> = { original: "عضو أصيل",     associate: "عضو مشارك" };
      const EN_GENDER:     Record<string, string> = { male: "Male",              female: "Female" };
      const EN_SPECIALTY:  Record<string, string> = { cardiology: "Cardiology",  cardiac_surgery: "Cardiac Surgery" };
      const EN_MEMBERSHIP: Record<string, string> = { original: "Original Member", associate: "Associate Member" };

      // Raw keys are always available from the format-data n8n node
      const gRaw = clean(data.genderRaw         ?? data.gender).toLowerCase();
      const sRaw = clean(data.specialtyRaw       ?? data.specialty).toLowerCase();
      const mRaw = clean(data.membershipTypeRaw  ?? data.membershipType).toLowerCase();

      const submittedAt = clean(data.submittedAt ?? new Date().toISOString());

      const AR_HEADERS = [
        "الاسم الأول", "الكنية", "الاسم بالعربية", "اسم الأب",
        "الاسم بالإنجليزية", "تاريخ الميلاد", "الجنس", "التخصص",
        "البريد الإلكتروني", "رقم الهاتف", "المدينة", "عنوان العمل",
        "تاريخ الانضمام", "نوع العضوية", "معرّف الجمعية الأوروبية", "تاريخ التسجيل",
      ];
      const EN_HEADERS = [
        "First name", "Last name", "Full name (Arabic)", "Father's name",
        "Full name (English)", "Date of birth", "Gender", "Specialty",
        "Email", "Phone", "City", "Work address",
        "Join date", "Membership type", "ESC ID", "Submitted at",
      ];

      const arRow = [
        clean(data.firstName),   clean(data.lastName),    clean(data.fullName),
        clean(data.fatherName),  clean(data.englishName), clean(data.birthDate),
        AR_GENDER[gRaw]     || clean(data.gender),
        AR_SPECIALTY[sRaw]  || clean(data.specialty),
        clean(data.email),       clean(data.phone),       clean(data.city),
        clean(data.workAddress), clean(data.joinDate),
        AR_MEMBERSHIP[mRaw] || clean(data.membershipType),
        clean(data.escId),       submittedAt,
      ];
      const enRow = [
        clean(data.firstName),   clean(data.lastName),    clean(data.fullName),
        clean(data.fatherName),  clean(data.englishName), clean(data.birthDate),
        EN_GENDER[gRaw]     || clean(data.genderRaw     ?? data.gender),
        EN_SPECIALTY[sRaw]  || clean(data.specialtyRaw  ?? data.specialty),
        clean(data.email),       clean(data.phone),       clean(data.city),
        clean(data.workAddress), clean(data.joinDate),
        EN_MEMBERSHIP[mRaw] || clean(data.membershipTypeRaw ?? data.membershipType),
        clean(data.escId),       submittedAt,
      ];

      const arFilePath = pathModule.join(excelDir, "نموذج-الأعضاء-عربي.xlsx");
      const enFilePath = pathModule.join(excelDir, "SCVA-Members-Template-EN.xlsx");

      // Helper: load existing workbook or create a fresh one with headers
      const loadOrCreate = (filePath: string, headers: string[], sheetName: string) => {
        if (fsModule.default.existsSync(filePath)) {
          const buf = fsModule.default.readFileSync(filePath);
          const wb = XLSX.default.read(buf, { type: "buffer" });
          const sn = wb.SheetNames[0];
          const ws = wb.Sheets[sn];
          const rows = XLSX.default.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
          if (rows.length === 0) {
            const freshWs = XLSX.default.utils.aoa_to_sheet([headers]);
            wb.Sheets[sn] = freshWs;
            return { wb, ws: freshWs, rows: [headers] as unknown[][] };
          }
          return { wb, ws, rows };
        }
        const wb = XLSX.default.utils.book_new();
        const ws = XLSX.default.utils.aoa_to_sheet([headers]);
        XLSX.default.utils.book_append_sheet(wb, ws, sheetName);
        return { wb, ws, rows: [headers] as unknown[][] };
      };

      // ── Duplicate detection (checks Arabic file — primary source of truth) ──
      const { wb: arWb, ws: arWs, rows: arRows } = loadOrCreate(arFilePath, AR_HEADERS, "الأعضاء");
      if (arRows.length > 1) {
        const inEmail    = String(data.email       ?? "").trim().toLowerCase();
        const inFullName = String(data.fullName    ?? "").trim();
        const inEnName   = String(data.englishName ?? "").trim();
        const inFirst    = String(data.firstName   ?? "").trim();
        const inLast     = String(data.lastName    ?? "").trim();

        for (const row of arRows.slice(1) as unknown[][]) {
          const rowEmail    = row[8] != null ? String(row[8]).trim().toLowerCase() : "";
          const rowFullName = row[2] != null ? String(row[2]).trim()               : "";
          const rowEnName   = row[4] != null ? String(row[4]).trim()               : "";
          const rowFirst    = row[0] != null ? String(row[0]).trim()               : "";
          const rowLast     = row[1] != null ? String(row[1]).trim()               : "";

          const emailMatch = inEmail && rowEmail && rowEmail === inEmail;
          const nameMatch  =
            !inEmail &&
            inFirst && rowFirst === inFirst && inLast && rowLast === inLast &&
            ((!inFullName && !rowFullName) || rowFullName === inFullName) &&
            ((!inEnName   && !rowEnName)   || rowEnName   === inEnName);

          if (emailMatch || nameMatch) {
            console.log(`[EXCEL] تم رفض تسجيل مكرر: ${inEmail || inFullName}`);
            return res.json({ success: true, isDuplicate: true, message: "هذا العضو مسجّل مسبقاً في الملف — لم تتم الإضافة." });
          }
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      // Write to Arabic file (wb/ws already loaded above — reuse them)
      XLSX.default.utils.sheet_add_aoa(arWs, [arRow], { origin: -1 });
      const arBuffer = XLSX.default.write(arWb, { type: "buffer", bookType: "xlsx" }) as Buffer;
      fsModule.default.writeFileSync(arFilePath, arBuffer);

      // Write to English file
      const { wb: enWb, ws: enWs } = loadOrCreate(enFilePath, EN_HEADERS, "Members");
      XLSX.default.utils.sheet_add_aoa(enWs, [enRow], { origin: -1 });
      const enBuffer = XLSX.default.write(enWb, { type: "buffer", bookType: "xlsx" }) as Buffer;
      fsModule.default.writeFileSync(enFilePath, enBuffer);

      // Count data rows (excluding header) to decide whether to send to Telegram
      const dataRowCount = arRows.length; // arRows already includes header + existing rows before this insert
      const totalAfterInsert = dataRowCount; // new row was appended above

      console.log(`[EXCEL] أُضيف صف جديد إلى الملفين — إجمالي البيانات: ${totalAfterInsert - 1} عضو`);

      const tgToken = settings.telegramBotToken?.trim() || "";
      const tgChat  = settings.telegramChatId?.trim()   || "";

      // ── Immediate notification for every new registration ──
      if (tgToken && tgChat) {
        (async () => {
          try {
            const c = (v: unknown) => (v != null ? String(v).trim() : "—") || "—";
            const memberCount = totalAfterInsert - 1;
            const text =
              `🔔 <b>تسجيل عضو جديد — الرابطة السورية لأمراض وجراحة القلب</b>\n\n` +
              `👤 <b>الاسم:</b> ${c(data.fullName)}\n` +
              `🔤 <b>English:</b> ${c(data.englishName)}\n` +
              `🏥 <b>التخصص:</b> ${c(data.specialty)}\n` +
              `🎫 <b>العضوية:</b> ${c(data.membershipType)}\n` +
              `📍 <b>المدينة:</b> ${c(data.city)}\n` +
              `📞 <b>الهاتف:</b> ${c(data.phone)}\n` +
              `📧 <b>البريد:</b> ${c(data.email) !== "—" ? c(data.email) : "—"}\n\n` +
              `📊 <b>إجمالي الأعضاء المسجَّلين:</b> ${memberCount}\n` +
              `⏰ <i>${new Date().toLocaleString("ar-SY", { timeZone: "Asia/Damascus" })}</i>`;

            await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: tgChat, text, parse_mode: "HTML" }),
            });
            console.log(`[TELEGRAM] ✅ تم إرسال إشعار التسجيل الجديد: ${c(data.fullName) || c(data.englishName)}`);
          } catch (tgErr) {
            console.error("[TELEGRAM] ❌ فشل إرسال إشعار التسجيل:", (tgErr as Error).message);
          }
        })();
      }

      // ── Auto-send Excel files to Telegram every 10 entries ──
      if (tgToken && tgChat && (totalAfterInsert - 1) % 10 === 0 && totalAfterInsert > 1) {
        // Fire-and-forget — don't block the HTTP response
        (async () => {
          try {
            const count = totalAfterInsert - 1;
            const tgBase = `https://api.telegram.org/bot${tgToken}`;

            // Helper: send one document via multipart/form-data using fetch + FormData
            const sendDoc = async (buf: Buffer, filename: string, caption: string) => {
              const form = new FormData();
              form.append("chat_id", tgChat);
              form.append("caption", caption);
              form.append("document", new Blob([buf], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              }), filename);
              const r = await fetch(`${tgBase}/sendDocument`, { method: "POST", body: form });
              return r.json();
            };

            const caption = `📊 *تقرير تلقائي — SCVA*\n✅ تم تسجيل *${count}* عضواً حتى الآن\n⏰ ${new Date().toLocaleString("ar-SY", { timeZone: "Asia/Damascus" })}`;

            await sendDoc(arBuffer, "نموذج-الأعضاء-عربي.xlsx", caption);
            await sendDoc(enBuffer, "SCVA-Members-EN.xlsx", caption);

            console.log(`[TELEGRAM] ✅ تم إرسال ملفَي Excel تلقائياً بعد ${count} إدخال`);
          } catch (tgErr) {
            console.error("[TELEGRAM] ❌ فشل إرسال ملفات Excel:", (tgErr as Error).message);
          }
        })();
      }

      res.json({
        success: true,
        isDuplicate: false,
        message: "تمت إضافة البيانات إلى ملفَي الإكسل بنجاح (عربي وإنجليزي)",
        files: ["نموذج-الأعضاء-عربي.xlsx", "SCVA-Members-Template-EN.xlsx"],
      });
    } catch (err) {
      next(err);
    }
  });

  // ---------- Admin: clear both Excel files (reset to headers only) ----------
  app.post("/api/admin/clear-excel", requireAdmin, async (_req, res, next) => {
    try {
      const XLSX     = await import("xlsx");
      const fsModule = await import("fs");
      const pathModule = await import("path");
      const excelDir = pathModule.resolve(process.cwd(), "docs/form_by_n8n");

      const AR_HEADERS = [
        "الاسم الأول","الكنية","الاسم بالعربية","اسم الأب",
        "الاسم بالإنجليزية","تاريخ الميلاد","الجنس","التخصص",
        "البريد الإلكتروني","رقم الهاتف","المدينة","عنوان العمل",
        "تاريخ الانضمام","نوع العضوية","معرّف الجمعية الأوروبية","تاريخ التسجيل",
      ];
      const EN_HEADERS = [
        "First name","Last name","Full name (Arabic)","Father's name",
        "Full name (English)","Date of birth","Gender","Specialty",
        "Email","Phone","City","Work address",
        "Join date","Membership type","ESC ID","Submitted at",
      ];

      const files = [
        { name: "نموذج-الأعضاء-عربي.xlsx",       headers: AR_HEADERS, sheet: "الأعضاء" },
        { name: "SCVA-Members-Template-EN.xlsx", headers: EN_HEADERS, sheet: "Members"  },
      ];

      for (const { name, headers, sheet } of files) {
        const wb = XLSX.default.utils.book_new();
        const ws = XLSX.default.utils.aoa_to_sheet([headers]);
        XLSX.default.utils.book_append_sheet(wb, ws, sheet);
        fsModule.default.writeFileSync(
          pathModule.join(excelDir, name),
          XLSX.default.write(wb, { type: "buffer", bookType: "xlsx" }),
        );
      }

      console.log("[EXCEL] تم مسح بيانات الملفَين وإعادتهما للترويسات فقط");
      res.json({ success: true, message: "تم مسح بيانات ملفَي Excel بنجاح" });
    } catch (err) {
      next(err);
    }
  });

  // ---------- Admin: manually send both Excel files to Telegram ----------
  app.post("/api/admin/send-excel-telegram", requireAdmin, async (_req, res, next) => {
    try {
      const settings = await storage.getFormSettings();
      const tgToken  = settings.telegramBotToken?.trim() || "";
      const tgChat   = settings.telegramChatId?.trim()   || "";

      if (!tgToken || !tgChat) {
        return res.status(400).json({ success: false, message: "إعدادات Telegram غير مضبوطة. أدخل التوكن ومعرّف المحادثة واحفظهما أولاً." });
      }

      const XLSX     = await import("xlsx");
      const fsModule = await import("fs");
      const pathModule = await import("path");
      const excelDir = pathModule.resolve(process.cwd(), "docs/form_by_n8n");

      const arPath = pathModule.join(excelDir, "نموذج-الأعضاء-عربي.xlsx");
      const enPath = pathModule.join(excelDir, "SCVA-Members-Template-EN.xlsx");

      // Count rows to include in caption
      let rowCount = 0;
      if (fsModule.default.existsSync(arPath)) {
        const buf  = fsModule.default.readFileSync(arPath);
        const wb   = XLSX.default.read(buf, { type: "buffer" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.default.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
        rowCount   = Math.max(0, rows.length - 1);
      }

      const tgBase = `https://api.telegram.org/bot${tgToken}`;
      const caption = `📊 *تقرير يدوي — SCVA*\n✅ إجمالي الأعضاء المسجَّلين: *${rowCount}*\n⏰ ${new Date().toLocaleString("ar-SY", { timeZone: "Asia/Damascus" })}`;

      const sendDoc = async (filePath: string, filename: string) => {
        if (!fsModule.default.existsSync(filePath)) return { ok: false, description: "الملف غير موجود" };
        const buf  = fsModule.default.readFileSync(filePath);
        const form = new FormData();
        form.append("chat_id", tgChat);
        form.append("caption", caption);
        form.append("document", new Blob([buf], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }), filename);
        const r = await fetch(`${tgBase}/sendDocument`, { method: "POST", body: form });
        return r.json() as Promise<{ ok: boolean; description?: string }>;
      };

      const [arResult, enResult] = await Promise.all([
        sendDoc(arPath, "نموذج-الأعضاء-عربي.xlsx"),
        sendDoc(enPath, "SCVA-Members-EN.xlsx"),
      ]);

      if (arResult.ok && enResult.ok) {
        console.log(`[TELEGRAM] ✅ تم إرسال ملفَي Excel يدوياً (${rowCount} عضو)`);
        res.json({ success: true, message: `تم إرسال الملفَين إلى Telegram بنجاح (${rowCount} عضو مسجَّل)` });
      } else {
        const err = arResult.description || enResult.description || "خطأ غير معروف";
        res.status(500).json({ success: false, message: `فشل الإرسال: ${err}` });
      }
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/admin/excel-download", requireAdmin, async (req, res, next) => {
    try {
      const lang = req.query.lang === "en" ? "en" : "ar";
      const pathModule = await import("path");
      const fsModule = await import("fs");

      const fileName = lang === "ar" ? "نموذج-الأعضاء-عربي.xlsx" : "SCVA-Members-Template-EN.xlsx";
      const filePath = pathModule.resolve(process.cwd(), "docs/form_by_n8n", fileName);

      if (!fsModule.default.existsSync(filePath)) {
        return res.status(404).json({ message: "الملف غير موجود" });
      }

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
      fsModule.default.createReadStream(filePath).pipe(res);
    } catch (err) {
      next(err);
    }
  });

  return httpServer;
}
