// Builds the standalone LicenseGenerator.exe (Node Single Executable Application).
// Run: npm run license:exe
import { execSync } from 'child_process'
import { copyFileSync } from 'fs'

const EXE = 'LicenseGenerator.exe'
const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'

console.log('1/3 building SEA blob…')
execSync('node --experimental-sea-config sea-config.json', { stdio: 'inherit' })

console.log('2/3 copying node runtime…')
copyFileSync(process.execPath, EXE)

console.log('3/3 injecting blob…')
execSync(`npx --yes postject ${EXE} NODE_SEA_BLOB tools/sea-prep.blob --sentinel-fuse ${FUSE}`, { stdio: 'inherit' })

console.log(`\nDone → ${EXE}  (keep it next to license-private.pem)`)
