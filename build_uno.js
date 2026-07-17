import { createGenerator } from '@unocss/core'
import presetUno from '@unocss/preset-uno'
import fs from 'fs'
import path from 'path'
import { globSync } from 'glob'

const uno = createGenerator({
  presets: [presetUno()],
})

const files = globSync('src/**/*.vue')
let code = ''
for(const f of files) {
  code += fs.readFileSync(f, 'utf8') + '\n'
}

uno.generate(code).then(({css}) => {
  fs.writeFileSync('uno-only.css', css)
  console.log('Done uno css:', css.length)
})
