import express from 'express';
import cors from 'cors';
import path from 'path';
import authRouter from './auth.route';
const app = express();
const PORT = process.env.PORT || 3000;
// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Trust proxy if behind Nginx/Caddy
app.set('trust proxy', 1);
// API Routes
app.use('/api/auth', authRouter);
// Serve static files from src (HTML, CSS) and dist (compiled JS)
app.use(express.static(path.join(__dirname, '../../src')));
app.use(express.static(path.join(__dirname, '../../dist')));
// Also handle case when running via ts-node where __dirname is backend/
app.use(express.static(path.join(process.cwd(), 'src')));
app.use(express.static(path.join(process.cwd(), 'dist')));
// Redirect root to login.html
app.get('/', (req, res) => {
    res.redirect('/login.html');
});
// Start server
app.listen(PORT, () => {
    console.log(`RenovaCloud API escuchando en http://localhost:${PORT}`);
});
