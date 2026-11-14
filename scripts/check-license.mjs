/** @OBS-001-L1-01: declared licence and distributed attribution agree. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { URL } from 'node:url'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n')
// Canonical https://www.apache.org/licenses/LICENSE-2.0.txt, checked 2026-11-14.
const apacheSha256 = 'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30'

test('@OBS-001-L1-01 LICENSE contains the complete canonical Apache-2.0 text', () => {
  assert.equal(createHash('sha256').update(read('LICENSE')).digest('hex'), apacheSha256)
})

test('@OBS-001-L1-01 package metadata declares Apache-2.0', () => {
  assert.equal(JSON.parse(read('package.json')).license, 'Apache-2.0')
})

test('@OBS-001-L1-01 README and NOTICE retain the declared licence and attribution', () => {
  const section = read('README.md').split('## Licence')[1]
  assert.match(section, /Apache-2\.0/)
  assert.doesNotMatch(section, /Not yet chosen/)
  assert.match(read('NOTICE'), /Copyright 2026 Akio Cox/)
  assert.match(read('NOTICE'), /Verkable App/)
})
