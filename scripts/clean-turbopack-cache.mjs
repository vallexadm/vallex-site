import { rm } from "node:fs/promises";
import path from "node:path";

// O cache do Turbopack pode guardar valores de ambiente lidos durante o build.
// Remove somente esses caches gerados, inclusive o restaurado pelo adaptador Netlify.
// Não modifica .env, código, banco nem configurações do scanner de segredos.
const root = path.resolve(process.cwd());
for (const relative of [".next/cache/turbopack", ".netlify/.next/cache/turbopack"]) {
  const target = path.resolve(root, relative);
  const within = path.relative(root, target);
  if (!within || within.startsWith("..") || path.isAbsolute(within)) throw new Error("Cache fora da pasta do projeto.");
  await rm(target, { recursive: true, force: true });
  console.log(`Cache gerado removido, se existente: ${relative}`);
}
