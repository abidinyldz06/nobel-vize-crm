import "server-only";

import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type StaffRole = "admin" | "consultant";

export interface StaffContext {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: StaffRole;
  is_active: boolean;
}

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function requireStaff() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new AuthorizationError("Oturum açmanız gerekiyor.", 401);
  }

  const { data: staff, error: staffError } = await supabase
    .from("staff")
    .select("id, user_id, full_name, email, role, is_active")
    .eq("user_id", user.id)
    .single();

  if (staffError || !staff || !staff.is_active) {
    throw new AuthorizationError("Aktif personel kaydı bulunamadı.", 403);
  }

  if (staff.role !== "admin" && staff.role !== "consultant") {
    throw new AuthorizationError("Geçersiz personel rolü.", 403);
  }

  return {
    supabase,
    user: user as User,
    staff: staff as StaffContext,
  };
}

export async function requireAdmin() {
  const context = await requireStaff();

  if (context.staff.role !== "admin") {
    throw new AuthorizationError("Bu işlem için yönetici yetkisi gerekiyor.", 403);
  }

  return context;
}
