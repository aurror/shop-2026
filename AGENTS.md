<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-rules -->
# Project: 3DPrintIt shop — read HANDOFF.md first

**Before doing anything**, read `/home/flo/shop/HANDOFF.md`. It contains the full project state, all known bugs, the tech stack, credentials, and the prioritized task list for what to do next.

## Critical rules for this codebase

### Starting the dev server
NEVER run `npm run dev` or `npx next dev` as a blocking command. It will stall your shell.
Always use:
```bash
setsid npx next dev --port 3000 > /tmp/next-dev.log 2>&1 < /dev/null &
```
Check it started: `tail -5 /tmp/next-dev.log` (look for "✓ Ready")

### UUID array queries — mandatory pattern
Drizzle ORM's `inArray()` generates broken SQL for UUID columns in PostgreSQL. NEVER use:
```ts
inArray(table.someUuidColumn, arrayOfIds)  // BROKEN
```
Always use:
```ts
sql`${table.someUuidColumn} = ANY(ARRAY[${sql.join(
  arrayOfIds.map((id) => sql`${id}::uuid`),
  sql`, `
)}])`
```

### Next.js 16 API rules
- Middleware file is `src/proxy.ts`, exports `proxy` function (not `middleware`)
- `params` in page/route components is a Promise — always `await params`
- `cookies()` and `headers()` are async — always `await` them

### Database
- Schema: `student_test` (set via `DB_SCHEMA` env var)
- The fallback in `schema.ts` and `drizzle.config.ts` still says `student_oc_test0404` — this is wrong but harmless since `.env` sets `DB_SCHEMA=student_test`
- Scripts: `node scripts/migrate.js` (reset schema), `node scripts/seed.js` (sample data — already run)

### TypeScript
- Run `npx tsc --noEmit` to verify 0 errors before considering any work done
<!-- END:project-rules -->
