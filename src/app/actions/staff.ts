"use server"
import { supabase } from "@/lib/supabase";
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

  const randomPassword = generateRandomPassword();

  // Auth user oluştur (Rastgele şifre ile)
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password: randomPassword,
  });

  if (authError) {
    console.error("Auth creation error:", authError.message);
    redirect('/staff?error=' + encodeURIComponent("Auth User oluşturulamadı: " + authError.message));
  }

  const userId = authData.user?.id;

  const { error } = await supabase.from('staff').insert([{
    user_id: userId,
    full_name: fullName,
    email,
    role,
    phone: phone || null,
    is_active: true,
  }]);

  if (error) {
    // Tablo yoksa bilgi ver
    console.error("Staff insert error:", error.message);
    redirect('/staff?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/staff');
  redirect('/staff?success=' + encodeURIComponent(`Personel eklendi. Geçici şifre: ${randomPassword}`));
}

export async function updateStaff(formData: FormData) {
  const id = formData.get('id') as string;
  const fullName = formData.get('fullName') as string;
  const email = formData.get('email') as string;
  const role = formData.get('role') as string;
  const phone = formData.get('phone') as string;
  const isActive = formData.get('isActive') === 'true';

  const { error } = await supabase.from('staff').update({
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
