#!/usr/bin/env node
import sharp from 'sharp';
import { readdir, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const INPUT = path.join(ROOT, 'bassday', 'images', 'source');
const OUTPUT = path.join(ROOT, 'bassday', 'images', 'web');
const MANIFEST = path.join(OUTPUT, 'manifest.json');
const WIDTHS = [480, 960, 1600];
const SUPPORTED = new Set(['.jpg','.jpeg','.png','.webp','.tif','.tiff','.avif','.heic','.heif']);

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0,80) || 'image';
const hash = b => crypto.createHash('sha256').update(b).digest('hex').slice(0,10);

async function walk(dir) {
  const out = [];
  try {
    for (const e of await readdir(dir, { withFileTypes:true })) {
      const p = path.join(dir,e.name);
      if (e.isDirectory()) out.push(...await walk(p));
      else if (SUPPORTED.has(path.extname(e.name).toLowerCase())) out.push(p);
    }
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  return out;
}

await mkdir(INPUT,{recursive:true});
await mkdir(OUTPUT,{recursive:true});
const files = await walk(INPUT);
const manifest = { version:1, generated:new Date().toISOString(), images:[] };

for (const src of files) {
  const buf = await sharp(src,{animated:false}).rotate().toBuffer();
  const meta = await sharp(buf).metadata();
  const id = `${slug(path.basename(src,path.extname(src)))}-${hash(buf)}`;
  const variants = [];
  for (const width of WIDTHS) {
    if (meta.width && width > meta.width && width !== WIDTHS[0]) continue;
    const filename = `${id}-${width}.webp`;
    await sharp(buf)
      .resize({width, withoutEnlargement:true, fit:'inside'})
      .webp({quality:82, effort:5, smartSubsample:true})
      .toFile(path.join(OUTPUT,filename));
    const info = await stat(path.join(OUTPUT,filename));
    variants.push({width,src:`images/web/${filename}`,bytes:info.size});
  }
  manifest.images.push({source:path.relative(ROOT,src).replaceAll('\\','/'),width:meta.width,height:meta.height,variants});
  console.log(`Processed ${path.basename(src)} -> ${variants.length} WebP variant(s)`);
}

await writeFile(MANIFEST,JSON.stringify(manifest,null,2)+'\n');
console.log(`Bass Day Ever image pipeline complete: ${files.length} source image(s).`);
