"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Home,
  Bell,
  BookOpen,
  Archive,
  Phone,
  Menu,
  X,
  LogOut,
  AppWindowMac,
  RotateCcw
} from "lucide-react"
import { useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"

const routes = [
  {
    name: "Home",
    path: "/",
    icon: Home,
  },
  {
    name: "Reminders",
    path: "/reminders",
    icon: Bell,
  },
  {
    name: "Resources",
    path: "/resources",
    icon: BookOpen,
  },
  {
    name: "Archive",
    path: "/archive",
    icon: Archive,
  },
  {
    name: "Developer",
    path: "/dev-dashboard",
    icon: AppWindowMac,
  },
  {
    name: "Contact Administration",
    path: "/contact",
    icon: Phone,
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const { data: session } = useSession()
  const router = useRouter()

  const handleClickOutside = (e: React.MouseEvent) => {
    if (isOpen && e.target === e.currentTarget) {
      setIsOpen(false)
    }
  }

  const handleResetProfile = () => {
    setIsOpen(false)
    router.push('/profile')
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30"
          onClick={handleClickOutside}
        />
      )}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-background border-r transition-all duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 pt-10">
            <h1 className="text-2xl pt-10 font-bold text-primary">PEC.UP</h1>
          </div>

          <ScrollArea className="flex-1">
            <nav className="px-2 py-4">
              <ul className="space-y-2">
                {routes.map((route) => (
                  <li key={route.path}>
                    <Link href={route.path} onClick={() => setIsOpen(false)}>
                      <Button
                        variant={pathname === route.path ? "secondary" : "ghost"}
                        className="w-full justify-start transition-all duration-200"
                      >
                        <route.icon className="mr-2 h-4 w-4" />
                        {route.name}
                      </Button>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </ScrollArea>

          {session && (
            <div className="p-4 border-t space-y-2">
              <Button
                variant="ghost"
                className="w-full flex justify-start gap-2 text-sm"
                onClick={handleResetProfile}
              >
                <RotateCcw className="h-4 w-4" />
                Reset Year & Branch
              </Button>
              <Button
                variant="ghost"
                className="w-full flex justify-start gap-2 text-sm"
                onClick={() => signOut()}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          )}

          <div className="p-4 text-xs text-muted-foreground">
            © 2025 Yeswanth Madasu
          </div>
        </div>
      </div>
    </>
  )
}
