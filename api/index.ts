// Vercel serverless entry point: all /api/* requests are rewritten here (see vercel.json)
// and handled by the same Express app used locally.
import app from "../server/app.js";

export default app;
