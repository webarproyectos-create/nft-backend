const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { generateNFT } = require('@node-ar-js/nft-marker-creator');

const app = express();
app.use(cors());
app.use(express.json());

// Datos de tu proyecto Supabase
const SUPABASE_URL = 'https://qxwekuvcqzgpygoiuopx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_MMY0mnCkegdi8jqVDwYFQQ_oZndvlyv';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const upload = multer({ dest: 'temp/' });

app.post('/api/convertir-nft', upload.single('imagen'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ninguna imagen.' });
    }

    const inputPath = req.file.path;
    const timestamp = Date.now();
    const outputDir = path.join(__dirname, 'temp', `nft_${timestamp}`);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 1. Compilación automática de la imagen a NFT en el servidor
    await generateNFT({
      inputPath: inputPath,
      outputPath: path.join(outputDir, 'marcador')
    });

    // 2. Subida automática de los 3 archivos a Supabase Storage
    const extensions = ['.iset', '.fset', '.fset3'];
    let baseUrlPath = '';

    for (const ext of extensions) {
      const fileName = `marcador${ext}`;
      const filePathOnDisk = path.join(outputDir, fileName);
      const storagePath = `nft_${timestamp}/marcador${ext}`;

      if (fs.existsSync(filePathOnDisk)) {
        const fileBuffer = fs.readFileSync(filePathOnDisk);
        const { error: uploadErr } = await supabase.storage
          .from('marcadores-mind')
          .upload(storagePath, fileBuffer, {
            contentType: 'application/octet-stream',
            upsert: true
          });

        if (uploadErr) throw uploadErr;

        if (ext === '.iset') {
          const { data } = supabase.storage
            .from('marcadores-mind')
            .getPublicUrl(`nft_${timestamp}/marcador`);
          baseUrlPath = data.publicUrl;
        }
      }
    }

    // 3. Limpieza de archivos temporales
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.unlinkSync(inputPath);

    // 4. Retornar la URL base lista para el visor AR.js NFT
    res.json({
      success: true,
      baseUrl: baseUrlPath
    });

  } catch (err) {
    console.error('Error al procesar NFT:', err);
    res.status(500).json({ error: err.message || 'Error en el servidor al generar NFT' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en el puerto ${PORT}`));