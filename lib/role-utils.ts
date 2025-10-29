import React from 'react'
import { Badge } from "@/components/ui/badge"

export const getRoleDisplay = (role: string): React.ReactElement => {
  switch (role) {
    case 'student':
      return React.createElement(Badge, { key: "student", variant: "secondary" }, "Student")
    case 'representative':
      return React.createElement(Badge, { key: "representative", variant: "default" }, "Representative")
    case 'admin':
      return React.createElement(Badge, { key: "admin", variant: "destructive" }, "Admin")
    case 'yeshh':
      return React.createElement(Badge, { key: "yeshh", variant: "destructive" }, "Yeshh")
    default:
      return React.createElement(Badge, { key: role, variant: "outline" }, role)
  }
}