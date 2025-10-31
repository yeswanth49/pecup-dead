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
  const [skipPopup, setSkipPopup] = useLocalStorage<boolean>("whatsapp_skip_popup", false)
  const [lastIncrementPath, setLastIncrementPath] = useState<string>("")

  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    // Check if user has permanently dismissed the popup - check localStorage directly
    const storedSkipValue = localStorage.getItem('whatsapp_skip_popup');
    if (storedSkipValue !== null && JSON.parse(storedSkipValue) === true) {
      return;
    }

    // Get current path for tracking page navigation
    const currentPath = window.location.pathname;

    // Only increment if this is a different page or first visit
    if (lastIncrementPath === "" || lastIncrementPath !== currentPath) {
      setLastIncrementPath(currentPath);

      setVisitCount(prev => {
        const newCount = prev + 1;
        const shouldSkip = localStorage.getItem('whatsapp_skip_popup') === JSON.stringify(true);
        if (newCount <= 10 && !shouldSkip) setShowPopup(true);
        return newCount;
      });
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleJoin = () => {
    window.open("https://chat.whatsapp.com/CRA9Iy7WWKT3yPc1homLyC", "_blank")
    setShowPopup(false)
  }

  const handleClose = () => {
    setShowPopup(false)
  }

  const handleDontShowAgain = () => {
    // Ensure the value is set to true in localStorage
    setSkipPopup(true);
    // Also directly set it to ensure it persists
    localStorage.setItem('whatsapp_skip_popup', JSON.stringify(true));
    setShowPopup(false);
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
        <div className="flex justify-between gap-3">
          <Button variant="ghost" onClick={handleDontShowAgain} className="text-xs">
            Don't show again
          </Button>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleClose}>
              Maybe Later
            </Button>
            <Button onClick={handleJoin}>
              Join Group
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}