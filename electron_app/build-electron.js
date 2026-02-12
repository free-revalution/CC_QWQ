// 使用esbuild编译electron目录下的TypeScript文件
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const electronDir = path.join(__dirname, 'electron');
const outDir = path.join(__dirname, 'dist-electron');

// 确保输出目录存在
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 编译electron目录下的所有TypeScript文件
esbuild.build({
  entryPoints: [path.join(electronDir, 'main.ts')],
  bundle: true,
  platform: 'node',
  target: 'node16',
  outfile: path.join(outDir, 'main.js'),
  external: [
    'electron', 
    'node-pty',
    'playwright',
    'playwright-core',
    '@larksuiteoapi/node-sdk',
    '@modelcontextprotocol/sdk',
    'express',
    'fs-extra',
    'lucide-react',
    'minimatch',
    'qrcode',
    'qrcode-terminal',
    'react',
    'react-dom',
    'react-window',
    'shiki',
    'whatsapp-web.js',
    'ws'
  ],
  sourcemap: true,
  metafile: true,
}).then(result => {
  console.log('✅ Electron TypeScript files compiled successfully');
  
  // 复制preload.js文件到输出目录
  const preloadSrc = path.join(electronDir, 'preload.js');
  const preloadDest = path.join(outDir, 'preload.js');
  
  if (fs.existsSync(preloadSrc)) {
    fs.copyFileSync(preloadSrc, preloadDest);
    console.log('✅ preload.js file copied successfully');
  } else {
    console.error('❌ preload.js file not found');
  }
  
  console.log(`📁 Output directory: ${outDir}`);
}).catch(error => {
  console.error('❌ Error compiling Electron TypeScript files:', error);
  process.exit(1);
});
