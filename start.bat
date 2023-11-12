pushd %~dp0
npm install --no-audit
npm run build
npm run start
pause
popd
