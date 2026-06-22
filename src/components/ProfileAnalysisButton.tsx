"use client"
import { useState } from "react";
import { BrainCircuit } from "lucide-react";
import ProfileAnalysisModal from "./ProfileAnalysisModal";

export default function ProfileAnalysisButton({ customerId, currentScore }: { customerId: string, currentScore: number }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button 
        onClick={() => setShowModal(true)}
        className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-xl transition-all shadow-sm"
        title="AI Profil Analizi"
      >
        <BrainCircuit className="w-5 h-5" />
      </button>

      {showModal && (
        <ProfileAnalysisModal 
          customerId={customerId} 
          currentScore={currentScore} 
          onClose={() => setShowModal(false)} 
        />
      )}
    </>
  );
}
