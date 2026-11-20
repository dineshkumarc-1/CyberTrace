import { z } from "zod";
export const uuid = z.uuid();
export const severity = z.enum(["Low", "Medium", "High", "Critical"]);
export const status = z.enum([
  "Open",
  "Investigating",
  "Contained",
  "Resolved",
  "Closed",
]);
export const links = z.object({
  assets: z.array(uuid).max(50).default([]),
  vulnerabilities: z.array(uuid).max(50).default([]),
  techniques: z.array(uuid).max(50).default([]),
});
export const incidentCreate = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().min(10).max(20000),
    severity,
    detected_at: z.iso.datetime({ offset: true }),
    assigned_to: uuid.nullable().optional(),
    ...links.shape,
  })
  .strict();
export const incidentPatch = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().min(10).max(20000).optional(),
    severity: severity.optional(),
    status: status.optional(),
    assigned_to: uuid.nullable().optional(),
    archived: z.boolean().optional(),
    version: z.number().int().positive(),
  })
  .strict();
export const reportCreate = z
  .object({
    summary: z.string().trim().min(5).max(2000),
    detailed_report: z.string().trim().min(10).max(30000),
    remediation_summary: z.string().max(5000).default(""),
    note: z.string().max(3000).default(""),
  })
  .strict();
export const logCreate = z
  .object({
    event_type: z.string().min(2).max(100),
    event_time: z.iso.datetime({ offset: true }),
    source_ip: z.union([z.ipv4(), z.ipv6()]).optional(),
    message: z.string().min(1).max(4000),
    raw_data: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export const remediationCreate = z
  .object({
    action: z.string().trim().min(3).max(200),
    description: z.string().max(5000).default(""),
  })
  .strict();
export const remediationPatch = z
  .object({ status: z.enum(["Pending", "In Progress", "Completed"]) })
  .strict();
export const userCreate = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z
      .email()
      .max(254)
      .transform((x) => x.toLowerCase()),
    password: z.string().min(12).max(72),
    role: z.enum(["Admin", "Analyst"]),
  })
  .strict();
export const refs = {
  assets: z
    .object({
      asset_name: z.string().min(1).max(150),
      asset_type: z.string().min(1).max(100),
      criticality: severity,
      owner_name: z.string().min(1).max(120),
      location: z.string().min(1).max(150),
    })
    .strict(),
  vulnerabilities: z
    .object({
      cve_id: z
        .string()
        .regex(/^CVE-[0-9]{4}-[0-9]{4,}$/)
        .nullable()
        .optional(),
      name: z.string().min(1).max(200),
      severity,
      description: z.string().min(1).max(5000),
      published_date: z.iso.date().nullable().optional(),
    })
    .strict(),
  techniques: z
    .object({
      technique_name: z.string().min(1).max(200),
      mitre_id: z
        .string()
        .regex(/^T[0-9]{4}(\.[0-9]{3})?$/)
        .nullable()
        .optional(),
      description: z.string().min(1).max(5000),
    })
    .strict(),
};
