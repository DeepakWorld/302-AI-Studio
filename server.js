import { handler } from './build/handler.js';
import express from 'express';

const app = express();
app.use(handler);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
