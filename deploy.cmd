@echo off
setlocal

set CLOUDFLARE_API_TOKEN=cfat_zjSS89lUEJmvalti2nEMx9Ys3Awmo4hgc6i7mq8Ic84e516d
set CLOUDFLARE_ACCOUNT_ID=6b4a5d2fd169232adec9f3625b4fc121

echo Deploying to Cloudflare Pages...
npx wrangler pages deploy dist --project-name=luri-blog --branch=main

endlocal
