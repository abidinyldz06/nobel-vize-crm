"use server"
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function generateRandomPassword(): string {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
  let pass = '';
  for (let i = 0; i < 8; i++) {
    pass += chars[Math.floor(Math.random() * chars.length)];
  }
  return pass;
}

export async function createStaff(formData: FormData) {
  const fullName = formData.get('fullName') as string;
  const email = formData.get('email') as string;
  const role = formData.get('role') as string;
  const phone = formData.get('phone') as string;

  const defaultPassword = '123456';

  // Auth user oluştur
  const serverClient = await createSupabaseServerClient();
  const { data: authData, error: authError } = await serverClient.auth.signUp({
    email,
    password: defaultPassword,
  });

  if (authError) {
    console.error("Auth creation error:", authError.message);
    redirect('/staff?error=' + encodeURIComponent("Auth User oluşturulamadı: " + authError.message));
  }

  const userId = authData.user?.id;

  // Veritabanı işlemleri için yetkili server client kullan (RLS'yi geçmek için)
  const { error } = await serverClient.from('staff').insert([{
    user_id: userId,
    full_name: fullName,
    email,
    role,
    phone: phone || null,
    is_active: true,
  }]);

  if (error) {
    console.error("Staff insert error:", error.message);
    redirect('/staff?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/staff');
  redirect('/staff?success=' + encodeURIComponent(`Personel eklendi. Geçici şifre: ${defaultPassword}`));
}

export async function updateStaff(formData: FormData) {
  const id = formData.get('id') as string;
  const fullName = formData.get('fullName') as string;
  const email = formData.get('email') as string;
  const role = formData.get('role') as string;
  const phone = formData.get('phone') as string;
  const isActive = formData.get('isActive') === 'true';

  const serverClient = await createSupabaseServerClient();
  const { error } = await serverClient.from('staff').update({
    full_name: fullName,
    email,
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
