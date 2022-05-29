#!/bin/bash
npx tsc
cat package.json > dist/package.json
cat README.md > dist/README.md
cat LICENSE > dist/LICENSE
mkdir -p dist/tl/static/
cat gramjs/tl/static/api.tl > dist/tl/static/api.tl
cat gramjs/tl/static/schema.tl > dist/tl/static/schema.tl
cat gramjs/tl/api.d.ts > dist/tl/api.d.ts
cat gramjs/define.d.ts > dist/define.d.ts
