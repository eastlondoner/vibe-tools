// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  typescript: {
    typeCheck: true,
    tsConfig: {
      compilerOptions: {
        types: ['node', '@cloudflare/workers-types'],
        skipLibCheck: true,
        outDir: '../.typecheck',
      },
      exclude: ['../alchemy/', '../server/'],
    },
  },
  compatibilityDate: '2025-04-16',
  devtools: { enabled: false },
  modules: ['@nuxt/eslint'],
  future: {
    compatibilityVersion: 4,
  },
  pages: true,
  ssr: false,
  nitro: {
    preset: 'cloudflare-module',
    prerender: {
      routes: ['/'],
      autoSubfolderIndex: false,
    },
    typescript: {
      strict: true,
      tsConfig: {
        compilerOptions: {
          types: ['node', '@cloudflare/workers-types'],
          skipLibCheck: true,
          outDir: '../.typecheck',
        },
        exclude: ['../alchemy/', '../app/'],
      },
    },
  },
});
