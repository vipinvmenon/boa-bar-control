#!/usr/bin/env node
/**
 * BAR-165 — every class a screen names must exist in the stylesheet.
 *
 * Four class names were used by built screens and defined nowhere:
 * `count-title` and `count-scope` (the receipt and waste headers, which
 * therefore rendered in the root Archivo face while every other flow header is
 * Oswald), `top-up-panel` (the bar's request form, which rendered with no
 * padding and no row gap, so its title sat on top of the first field label and
 * its CTA ran off the sheet) and `top-up-queue`.
 *
 * They shipped because `test:visual` covered only the 22 design screens, and
 * three of the four defects were on routes the design does not have. A typo in a
 * class name is silent in CSS: nothing errors, the element simply inherits.
 *
 * This is the cheap check that makes it loud. It is deliberately one-directional
 * about failure — an unused rule is reported but does not fail, because a rule
 * may be waiting for a screen that lands next week, while a missing rule is
 * always a defect.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const CSS = path.join(ROOT, 'src/styles.css')
const SRC = path.join(ROOT, 'src')

/**
 * Class names that are legitimately absent from `styles.css`: the print sheet's
 * paper-only rules, and anything a third party owns.
 */
const ALLOWED = new Set()

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.name.endsWith('.tsx')) out.push(full)
  }
  return out
}

const css = fs.readFileSync(CSS, 'utf8')
const defined = new Set([...css.matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1]))

/** Where each used class name appears, so a failure names the file. */
const used = new Map()
for (const file of walk(SRC)) {
  const source = fs.readFileSync(file, 'utf8')
  // `className="a b"` and `className={`a ${x} b`}`. Interpolations are blanked
  // rather than parsed: a computed name (`tone-${t}`) cannot be checked here and
  // its literal prefix is not a class.
  for (const match of source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    const raw = (match[1] ?? match[2]).replace(/\$\{[^}]*\}/g, ' ')
    for (const name of raw.split(/\s+/)) {
      if (!name || name.endsWith('-') || ALLOWED.has(name)) continue
      if (!used.has(name)) used.set(name, new Set())
      used.get(name).add(path.relative(ROOT, file))
    }
  }
}

const missing = [...used.entries()].filter(([name]) => !defined.has(name))

if (missing.length > 0) {
  console.error(`\n${missing.length} class name(s) used by a screen and defined nowhere in src/styles.css:\n`)
  for (const [name, files] of missing.sort()) {
    console.error(`  .${name}`)
    for (const file of [...files].sort()) console.error(`      ${file}`)
  }
  console.error('\nA missing rule is silent in CSS — the element inherits and the screen looks wrong.\n')
  process.exit(1)
}

console.log(`${used.size} class names used, all defined.`)
