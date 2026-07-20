"use server"
import { requireAdmin } from "@/lib/authz";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createStaff(formData: FormData) {
  const { supabase: serverClient } = await requireAdmin();
  const fullName = formData.get('fullName') as string;
  const email = formData.get('email') as string;
  const role = formData.get('role') as string;
  const phone = formData.get('phone') as string;

  if (!fullName?.trim() || !email?.trim()) {
    redirect('/staff?error=' + encodeURIComponent('Ad soyad ve e-posta zorunludur.'));
  }

  if (role !== 'admin' && role !== 'consultant') {
    redirect('/staff?error=' + encodeURIComponent('Geçersiz personel rolü.'));
  }

  const adminClient = createSupabaseAdminClient();
  const { data: authData, error: authError } = await adminClient.auth.admin.inviteUserByEmail(email.trim(), {
    data: { full_name: fullName.trim() },
  });

  if (authError) {
    console.error("Auth creation error:", authError.message);
    redirect('/staff?error=' + encodeURIComponent("Auth User oluşturulamadı: " + authError.message));
  }

  const userId = authData.user.id;

  const { error } = await serverClient.from('staff').insert([{
    user_id: userId,
    full_name: fullName.trim(),
    email: email.trim().toLowerCase(),
    role,
    phone: phone || null,
    is_active: true,
  }]);

  if (error) {
    await adminClient.auth.admin.deleteUser(userId);
    console.error("Staff insert error:", error.message);
    redirect('/staff?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/staff');
  redirect('/staff?success=' + encodeURIComponent('Personel eklendi ve güvenli davet bağlantısı e-posta adresine gönderildi.'));
}

export async function updateStaff(formData: FormData) {
  const { supabase: serverClient } = await requireAdmin();
  const id = formData.get('id') as string;
  const fullName = formData.get('fullName') as string;
  const email = formData.get('email') as string;
  const role = formData.get('role') as string;
  const phone = formData.get('phone') as string;
  const isActive = formData.get('isActive') === 'true';

  if (!id || !fullName?.trim() || !email?.trim()) {
    redirect('/staff?error=' + encodeURIComponent('Eksik personel bilgisi.'));
  }

  if (role !== 'admin' && role !== 'consultant') {
    redirect('/staff?error=' + encodeURIComponent('Geçersiz personel rolü.'));
  }

  const { data: existingStaff, error: existingError } = await serverClient
    .from('staff')
    .select('user_id')
    .eq('id', id)
    .single();

  if (existingError || !existingStaff) {
    redirect('/staff?error=' + encodeURIComponent('Personel kaydı bulunamadı.'));
  }

  if (existingStaff.user_id) {
    const adminClient = createSupabaseAdminClient();
    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(existingStaff.user_id, {
      email: email.trim().toLowerCase(),
      user_metadata: { full_name: fullName.trim() },
    });

    if (authUpdateError) {
      redirect('/staff?error=' + encodeURIComponent('Kimlik hesabı güncellenemedi: ' + authUpdateError.message));
    }
  }

  const { error } = await serverClient.from('staff').update({
    full_name: fullName.trim(),
    email: email.trim().toLowerCase(),
    role,
    phone: phone || null,
    is_active: isActive,
  }).eq('id', id);

  if (error) {
    console.error("Staff update error:", error.message);
    redirect('/staff?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/staff');
  redirect('/staff');
}
