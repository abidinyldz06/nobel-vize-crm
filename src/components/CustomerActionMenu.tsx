"use client"
import { useState, useRef, useEffect } from "react"
import { MoreVertical, Edit, UserPlus, Trash2, AlertCircle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createSupabaseBrowserClient } from "@/lib/supabase-browser"
import { assignStaff } from "@/app/actions/assign-staff"
import type { Tables } from "@/types/database"

export default function CustomerActionMenu({ customerId, isAdmin, currentStaffId }: { customerId: string, isAdmin: boolean, currentStaffId?: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [staffList, setStaffList] = useState<Pick<Tables<'staff'>, 'id' | 'full_name' | 'role'>[]>([])
  const [selectedStaff, setSelectedStaff] = useState<string>(currentStaffId || "")
  const [isAssigning, setIsAssigning] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (showAssignModal && isAdmin && staffList.length === 0) {
      const fetchStaff = async () => {
        const supabase = createSupabaseBrowserClient()
        const { data } = await supabase.from('staff').select('id, full_name, role').eq('is_active', true)
        if (data) setStaffList(data)
      }
      fetchStaff()
    }
  }, [showAssignModal, isAdmin, staffList.length])

  const handleDelete = async () => {
    setIsDeleting(true)
    const supabase = createSupabaseBrowserClient()
    await supabase.from('customers').delete().eq('id', customerId)
    setIsOpen(false)
    setShowDeleteConfirm(false)
    router.refresh()
  }

  const handleAssign = async () => {
    setIsAssigning(true)
    await assignStaff(customerId, selectedStaff === "unassigned" ? null : selectedStaff)
    setIsAssigning(false)
    setShowAssignModal(false)
    setIsOpen(false)
    router.refresh()
  }

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button 
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(!isOpen) }} 
        className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors inline-flex"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-48 rounded-xl bg-white dark:bg-[#0d1420] shadow-lg shadow-black/20 border border-slate-200 dark:border-[#1f2937] overflow-hidden">
          <div className="py-1">
            <Link 
              href={`/customers/${customerId}/edit`}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => setIsOpen(false)}
            >
              <Edit className="w-4 h-4 text-blue-500" /> Düzenle
            </Link>
            
            {isAdmin && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowAssignModal(true); setIsOpen(false) }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
              >
                <UserPlus className="w-4 h-4 text-emerald-500" /> Danışman Ata
              </button>
            )}

            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDeleteConfirm(true); setIsOpen(false) }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-left"
            >
              <Trash2 className="w-4 h-4" /> Sil
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4 text-red-500">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-lg font-bold">Müşteriyi Sil</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
              Bu müşteriyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve müşteriye ait tüm başvuru, evrak ve ödeme kayıtları da silinir.
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                İptal
              </button>
              <button 
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? "Siliniyor..." : "Evet, Sil"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Staff Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Danışman Ata</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
              Bu müşteriyle ilgilenecek personeli seçin.
            </p>
            
            <div className="mb-6">
              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#060c18] border border-slate-200 dark:border-[#1f2937] rounded-xl focus:outline-none focus:border-blue-500 text-sm text-slate-900 dark:text-white"
              >
                <option value="unassigned">Atanmadı (Boş Bırak)</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name} ({s.role === 'admin' ? 'Yönetici' : 'Danışman'})</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                İptal
              </button>
              <button 
                onClick={handleAssign}
                disabled={isAssigning}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isAssigning ? "Atanıyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
