// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    optimizeDeps: {
      // Do not let a mounted preview mix React modules from different
      // optimization generations when lazy wallet/UI dependencies arrive.
      ignoreOutdatedRequests: false,
      include: [
        '@radix-ui/react-slot',
        '@radix-ui/react-dialog',
        '@tonconnect/ui-react',
        'sonner',
        'lucide-react',
        '@tanstack/router-core',
        '@tanstack/router-core/isServer',
        '@tanstack/router-core/ssr/client',
        'seroval',
      ],
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
