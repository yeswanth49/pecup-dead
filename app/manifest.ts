import type { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PEC.UP - Resource Hub",
    short_name: "PEC.UP",
    description: "PEC.UP Provides resources that are actually useful",
    start_url: "/",
    display: "standalone",
    categories: ["studies", "ai", "resources"],
    theme_color: "#171717",
    background_color: "#171717",
    icons: [
      {
        src: "/placeholder-logo.png",
        sizes: "any",
        type: "image/png"
      },
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png"
      }
    ],
  }
}