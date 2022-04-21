# poc-request-queue

## Prepare

```bash
docker-compose up
ts-node src/index.ts
```

## Test

Using https://github.com/wg/wrk

```bash
brew install wrk
```

Runs a benchmark using 10 threads, and keeping 10 HTTP connections open, for 30 seconds and timeout is 60 seconds

```bash
wrk -t10 -c10 -d30s --timeout 60 http://127.0.0.1:3000
wrk -t10 -c10 -d30s --timeout 60 http://127.0.0.1:3001
```

Analyze https://github.com/clinicjs/node-clinic

```bash
npm run compile
clinic doctor -- node ./build/src/index.js
clinic bubbleprof -- node ./build/src/index.js
```
