#!/usr/bin/env node
import sharp from 'sharp';
import { readdir, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const INPUT = path.join(ROOT, 'bassday', 'images');
const OUTPUT = path.join(INPUT, 'web');
const MANIFEST = path.join(OUTPUT, 'manifest.json');
const WIDTHS = [480, 960, 1600];
const SUPPORTED = new Set(['.jpg','.jpeg','.png','.webp','.tif','.tiff','.avif','.heic','.heif']);
const SKIP_DIRS = new Set(['web','source']);

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0,80) || 'image';
const hash = b => crypto.createHash('sha256').update(b).digest('hex').slice(0,10);

async function walk(dir) {
  const out = [];
  try {
    for (const e of await readdir(dir, { withFileTypes:true })) {
      if (e.isDirectory() && SKIP_DIRS.has(e.name.toLowerCase())) continue;
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
const manifest = { version:2, generated:new Date().toISOString(), widths:WIDTHS, images:[] };

for (const src of files) {
  try {
    const original = sharp(src,{animated:false}).rotate();
    const meta = await original.metadata();
    const sourceBuffer = await original.toBuffer();
    const id = `${slug(path.basename(src,path.extname(src)))}-${hash(sourceBuffer)}`;
    const variants = [];

    for (const requestedWidth of WIDTHS) {
      const actualWidth = meta.width ? Math.min(requestedWidth, meta.width) : requestedWidth;
      if (variants.some(v => v.width === actualWidth)) continue;
      const filename = `${id}-${actualWidth}.webp`;
      await sharp(sourceBuffer)
        .resize({width:actualWidth, withoutEnlargement:true, fit:'inside'})
        .webp({quality:82, effort:5, smartSubsample:true})
        .toFile(path.join(OUTPUT,filename));
      const info = await stat(path.join(OUTPUT,filename));
      variants.push({width:actualWidth,src:`images/web/${filename}`,bytes:info.size});
    }

    variants.sort((a,b) => a.width-b.width);
    manifest.images.push({
      source:path.relative(ROOT,src).replaceAll('\\','/'),
      width:meta.width,
      height:meta.height,
      aspectRatio:meta.width && meta.height ? Number((meta.width/meta.height).toFixed(4)) : null,
      variants
    });
    console.log(`Processed ${path.basename(src)} -> ${variants.length} WebP variant(s)`);
  } catch (error) {
    console.warn(`Skipped ${path.basename(src)}: ${error.message}`);
  }
}

manifest.images.sort((a,b) => a.source.localeCompare(b.source));
await writeFile(MANIFEST,JSON.stringify(manifest,null,2)+'\n');
console.log(`Bass Day Ever image pipeline complete: ${manifest.images.length} source image(s).`);
