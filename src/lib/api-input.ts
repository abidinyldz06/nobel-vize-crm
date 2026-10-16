import { z } from "zod";
import { APPLICATION_STATUSES } from "@/lib/application-status";

const uuidText = z.string().trim().min(1).max(64);

export const applicationStatusSchema = z.object({
  applicationId: uuidText,
  status: z.enum(APPLICATION_STATUSES),
  rejectionReason: z.string().max(2000).optional(),
}).superRefine((value, context) => {
  if (value.status === "reddedildi" && !value.rejectionReason?.trim()) {
    context.addIssue({ code: "custom", path: ["rejectionReason"], message: "Ret sebebi gereklidir." });
  }
});

export const taskCreateSchema = z.union([
  z.object({ action: z.literal("sync_data_quality") }),
  z.object({
    title: z.string().trim().min(1).max(160),
    description: z.string().max(2000).nullable().optional(),
    due_at: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Geçerli bir görev tarihi gereklidir."),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    assigned_staff_id: uuidText.nullable().optional(),
    customer_id: uuidText.nullable().optional(),
  }),
]);

export const taskUpdateSchema = z.union([
  z.object({
    id: uuidText,
    assigned_staff_id: uuidText,
  }),
  z.object({
    id: uuidText,
    status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
  }),
]);

export const appointmentStatusSchema = z.object({
  status: z.enum(["scheduled", "cancelled", "no_show", "completed"]),
  note: z.string().max(1000).optional(),
});

export const customerImportSchema = z.object({
  rows: z.array(z.unknown()).min(1).max(1000),
  resolutionMode: z.enum(["skip", "update"]),
});

export const bulkCustomerSchema = z.object({
  action: z.enum(["archive", "update_status", "assign_staff"]),
  customerIds: z.array(uuidText).min(1),
  applicationIds: z.array(uuidText).optional(),
  value: z.string().max(200).nullable().optional(),
});

export const anonymizeCustomerSchema = z.object({
  requestId: uuidText,
});

export const portalUploadSchema = z.object({
  documentId: uuidText,
  fileName: z.string().max(255),
  contentType: z.string().max(200),
  size: z.number().finite(),
});

export const portalCommitSchema = portalUploadSchema.extend({
  path: z.string().min(1).max(500),
});

export const mobileTaskSchema = z.object({
  title: z.string(),
  detail: z.string().optional(),
  dueAt: z.string(),
  priority: z.enum(["low", "normal", "high"]).optional(),
}).strip();

export const mobileNoteSchema = z.object({
  content: z.string(),
}).strip();

export const mobileApplicationStatusSchema = z.object({
  status: z.string(),
  rejectionReason: z.string().nullable().optional(),
}).strip();

export const mobileAppointmentStatusSchema = z.object({
  status: z.string(),
  note: z.string().nullable().optional(),
}).strip();

export const mobilePasswordSchema = z.object({
  email: z.string(),
  password: z.string(),
}).strip();

export const mobileMfaSchema = z.object({
  challengeId: z.string(),
  factorId: z.string(),
  code: z.string(),
}).strip();

export const mobileCompleteSchema = z.object({}).strip();

export const mobileGoogleFinishSchema = z.object({
  code: z.string(),
  verifier: z.string(),
}).strip();
