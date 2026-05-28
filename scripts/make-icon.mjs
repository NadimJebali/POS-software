// Renders build/icon.svg into build/icon.png (1024) and a multi-size build/icon.ico.
// Run with: npm run icon
import { Resvg } from '@resvg/resvg-js'
import pngToIco from 'png-to-ico'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'build/icon.svg'), 'utf8')

const render = (size) =>
  Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng())

writeFileSync(join(root, 'build/icon.png'), render(1024))
const ico = await pngToIco([256, 128, 64, 48, 32, 16].map(render))
writeFileSync(join(root, 'build/icon.ico'), ico)
console.log('Generated build/icon.png and build/icon.ico')
