const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DB_FILE = path.join(__dirname, 'productos.json');

// Asegurar que existan la carpeta de subidas y el "archivo base de datos"
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '[]');

// --- Configuración de Multer (subida de imágenes) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + ext);
  }
});

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB máx.
  fileFilter: (req, file, cb) => {
    if (TIPOS_PERMITIDOS.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Formato de imagen no permitido (usa jpg, png, webp o gif)'));
  }
});

app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public'))); // sirve /html, /css, etc.

// --- Helpers de lectura/escritura del "DB" en JSON ---
function leerProductos() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function guardarProductos(productos) {
  fs.writeFileSync(DB_FILE, JSON.stringify(productos, null, 2));
}

// --- Rutas de la API ---

// Listar todos los productos
app.get('/api/productos', (req, res) => {
  res.json(leerProductos());
});

// Crear un producto nuevo (con imagen)
app.post('/api/productos', (req, res) => {
  upload.single('imagen')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    const { nombre, caracteristicas, precio } = req.body;

    if (!nombre || !nombre.trim() || !precio) {
      return res.status(400).json({ error: 'El nombre y el precio son obligatorios' });
    }

    const precioNum = parseFloat(precio);
    if (isNaN(precioNum) || precioNum < 0) {
      return res.status(400).json({ error: 'El precio debe ser un número válido' });
    }

    const productos = leerProductos();

    const nuevoProducto = {
      id: Date.now().toString(),
      nombre: nombre.trim(),
      caracteristicas: (caracteristicas || '').trim(),
      precio: precioNum,
      imagen: req.file ? `/uploads/${req.file.filename}` : null,
      creadoEn: new Date().toISOString()
    };

    productos.push(nuevoProducto);
    guardarProductos(productos);

    res.status(201).json(nuevoProducto);
  });
});

// Eliminar un producto (y su imagen del disco)
app.delete('/api/productos/:id', (req, res) => {
  const productos = leerProductos();
  const idx = productos.findIndex(p => p.id === req.params.id);

  if (idx === -1) {
    return res.status(404).json({ error: 'Producto no encontrado' });
  }

  const [eliminado] = productos.splice(idx, 1);
  guardarProductos(productos);

  if (eliminado.imagen) {
    const imgPath = path.join(__dirname, eliminado.imagen);
    fs.unlink(imgPath, () => {}); // si falla, no rompe la respuesta
  }

  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Servidor de El Arabito corriendo en http://localhost:${PORT}`);
});
