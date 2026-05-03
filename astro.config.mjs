import { defineConfig } from 'astro/config'
import tailwind from '@astrojs/tailwind'

export default defineConfig({
  site: 'https://bbocangel-ai.github.io',
  base: '/potrero-herramientas/',
  integrations: [tailwind()],
})
