import fs from 'fs';
import sharp from 'sharp';

const customerSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="black" rx="100"/>
  <text x="256" y="415" font-family="Montserrat, sans-serif" font-weight="900" font-size="460" fill="white" text-anchor="middle">B</text>
</svg>
`;

const adminSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#fcd34d" rx="100"/>
  <text x="256" y="360" font-family="Montserrat, sans-serif" font-weight="900" font-size="400" fill="black" text-anchor="middle">B</text>
  <text x="256" y="460" font-family="Montserrat, sans-serif" font-weight="bold" font-size="70" fill="black" text-anchor="middle">ADMIN</text>
</svg>
`;

async function generate() {
  // Customer Icons
  await sharp(Buffer.from(customerSvg))
    .resize(192, 192)
    .png()
    .toFile('public/pwa-192x192.png');
    
  await sharp(Buffer.from(customerSvg))
    .resize(512, 512)
    .png()
    .toFile('public/pwa-512x512.png');

  // Admin Icons
  await sharp(Buffer.from(adminSvg))
    .resize(192, 192)
    .png()
    .toFile('public/admin-pwa-192x192.png');
    
  await sharp(Buffer.from(adminSvg))
    .resize(512, 512)
    .png()
    .toFile('public/admin-pwa-512x512.png');

  console.log("PWA Icons generated successfully!");
}

generate().catch(console.error);
