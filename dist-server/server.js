"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const auth_route_1 = __importDefault(require("./auth.route"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Trust proxy if behind Nginx/Caddy
app.set('trust proxy', 1);
// API Routes
app.use('/api/auth', auth_route_1.default);
// Serve static files from src (HTML, CSS) and dist (compiled JS)
app.use(express_1.default.static(path_1.default.join(__dirname, '../../src')));
app.use(express_1.default.static(path_1.default.join(__dirname, '../../dist')));
// Also handle case when running via ts-node where __dirname is backend/
app.use(express_1.default.static(path_1.default.join(process.cwd(), 'src')));
app.use(express_1.default.static(path_1.default.join(process.cwd(), 'dist')));
// Redirect root to login.html
app.get('/', (req, res) => {
    res.redirect('/login.html');
});
// Start server
app.listen(PORT, () => {
    console.log(`RenovaCloud API escuchando en http://localhost:${PORT}`);
});
