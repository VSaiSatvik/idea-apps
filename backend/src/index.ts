import { createApp, seedDemo } from "./app.js";

if (process.env.SEED_DEMO !== "off") seedDemo();
const port = Number(process.env.PORT ?? 8080);
createApp().listen(port, () => console.log(`Idea apps backend on http://localhost:${port}`));
