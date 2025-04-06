"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Home, Bell, BookOpen, Archive, Phone, Menu, X } from "lucide-react"
import { useState } from "react"

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
    name: "Contact Administration",
    path: "/contact",
    icon: Phone,
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  // Close sidebar when clicking outside
  const handleClickOutside = (e: React.MouseEvent) => {
    if (isOpen && e.target === e.currentTarget) {
      setIsOpen(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="fixed top-6 left-6 z-50"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>

      {/* Overlay */}
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
          <div className="p-4 border-t">
            <p className="text-xs text-muted-foreground">© 2025 Resource Hub</p>
          </div>
        </div>
      </div>
    </>
  )
}

