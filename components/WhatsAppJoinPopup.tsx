"use client"

import { useEffect, useRef, useState } from "react"
import { MessageCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useLocalStorage } from "@/hooks/use-local-storage"

export default function WhatsAppJoinPopup() {
  const [visitCount, setVisitCount] = useLocalStorage<number>("whatsapp-popup-visits", 0)
  const [showPopup, setShowPopup] = useState(false)
  const hasInitialized = useRef(false)

  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    console.log('[WhatsAppJoinPopup] useEffect running, current visitCount:', visitCount)
    const newCount = visitCount + 1
    console.log('[WhatsAppJoinPopup] Setting new visitCount to:', newCount)
    setVisitCount(newCount)

    // Show popup for first 10 visits
    if (newCount <= 10) {
      console.log('[WhatsAppJoinPopup] Showing popup for visit count:', newCount)
      setShowPopup(true)
    } else {
      console.log('[WhatsAppJoinPopup] Not showing popup, visit count:', newCount)
    }
  }, []) // Empty dependency array - only run once on mount

  const handleJoin = () => {
    window.open("https://chat.whatsapp.com/CRA9Iy7WWKT3yPc1homLyC", "_blank")
    setShowPopup(false)
  }

  const handleClose = () => {
    setShowPopup(false)
  }

  return (
    <Dialog open={showPopup} onOpenChange={setShowPopup}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Join PEC.UP Community</DialogTitle>
          <DialogDescription>
            Connect with fellow students, get updates, and access exclusive resources.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Maybe Later
          </Button>
          <Button onClick={handleJoin}>
            Join Group
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}