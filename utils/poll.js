function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function pollUntil({ check, isDone, isFail, intervalMs=2000, maxWaitMs=15*60*1000, backoff=1.5 }) {
  let waited = 0, current = intervalMs;
  while (waited <= maxWaitMs) {
    const resp = await check();
    if (isFail(resp)) return { done:false, failed:true, resp };
    if (isDone(resp)) return { done:true, failed:false, resp };
    const jitter = Math.floor(Math.random()*250);
    await sleep(current + jitter); waited += current + jitter;
    current = Math.min(current*backoff, 10_000);
  }
  return { done:false, failed:true, timeout:true };
}

module.exports = { pollUntil };
