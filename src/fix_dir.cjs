const fs = require('fs');
const path1 = 'd:/desktop/UAV/dji_way_line_business/src/types/waypointRoute.js';
let content1 = fs.readFileSync(path1, 'utf8');
content1 = content1.replace(/directoryName:\s*''/g, "directoryName: 'DJI_001'");
fs.writeFileSync(path1, content1);

const path2 = 'd:/desktop/UAV/dji_way_line_business/src/utils/kmzGenerator.js';
let content2 = fs.readFileSync(path2, 'utf8');
content2 = content2.replace(/params\.directoryName\s*\|\|\s*''/g, "params.directoryName || 'DJI_001'");
fs.writeFileSync(path2, content2);
console.log('Fixed');
