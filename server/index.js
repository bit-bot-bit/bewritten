import { initApp, app } from './app.js';

const PORT = Number(process.env.BEWRITTEN_API_PORT || 8787);

async function start() {
  await initApp();
  app.listen(PORT, () => {
    console.log(`bewritten backend listening on http://localhost:${PORT}`);
  });
}

start();
